/**
 * `createPlayer(handle, options)`: plays animations and timelines on the
 * elements of a ui-dom render handle.
 *
 * - CSS tracks run on the Web Animations API (`options.animate`, default
 *   `element.animate(keyframes, options)`);
 * - effects (`decipher`, ...) and non-CSS tracks (`text`, ...) run in a
 *   frame loop driven by `options.clock`, which also decides when
 *   `finished` resolves, so a manual clock makes playback deterministic;
 * - under reduced motion the `(reduced-motion ...)` variant plays (or, when
 *   there is none, only the opacity tracks, with duration 0). The default
 *   `motion` is `reduced` when the closest `[data-motion]` ancestor of the
 *   element says `reduced` or the user agent prefers reduced motion.
 */

import { systemClock } from './clock.js';
import { isCssProperty as defaultIsCss } from './compile-waapi.js';
import { loadAnimations, ANIMATION_STATES } from './model.js';
import { createControl, defaultApply, startRun, variantFor } from './run.js';
import { flattenTimeline } from './timeline.js';

/**
 * The default motion preference of an element: `reduced` when its closest
 * `[data-motion]` boundary says `reduced` or the user agent prefers reduced
 * motion; an explicit `data-motion="full"` does not override the user
 * agent preference (the safe default).
 * @param {Element|null} element
 * @returns {'full'|'reduced'}
 */
export function defaultMotion(element) {
  const boundary = element?.closest?.('[data-motion]');
  if (boundary?.getAttribute('data-motion') === 'reduced') {
    return 'reduced';
  }
  const query = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  return query?.matches ? 'reduced' : 'full';
}

/** How a player finds the element of an id. */
function elementLookup(handle) {
  return (id) => {
    if (id === null || id === undefined) {
      return null;
    }
    if (typeof handle === 'function') {
      return handle(id) ?? null;
    }
    if (handle && typeof handle.nodeFor === 'function') {
      return handle.nodeFor(id) ?? null;
    }
    return globalThis.document?.getElementById(id) ?? null;
  };
}

function emptyModel() {
  return {
    animations: new Map(),
    timelines: new Map(),
    triggers: [],
    diagnostics: [],
  };
}

/** Merge animations (Links Notation text or a loaded model) into `model`. */
function loadInto(model, source) {
  const loaded = typeof source === 'string' ? loadAnimations(source) : source;
  for (const [id, a] of loaded.animations) {
    model.animations.set(id, a);
  }
  for (const [id, t] of loaded.timelines) {
    model.timelines.set(id, t);
  }
  model.triggers.push(...(loaded.triggers ?? []));
  model.diagnostics.push(...(loaded.diagnostics ?? []));
  return loaded;
}

/** Play an animation or a timeline. */
function playId(context, id, playOptions = {}) {
  const { model } = context;
  if (!model.animations.has(id) && !model.timelines.has(id)) {
    throw new RangeError(`unknown animation or timeline "${id}"`);
  }
  const targetOf = (entry, animation) =>
    context.elementFor(entry.target ?? animation.target);
  const schedule = flattenTimeline(model, id, {
    resolveToken: context.resolveToken,
    variant: (animation) =>
      variantFor(
        context,
        animation,
        context.elementFor(playOptions.target ?? animation.target)
      ),
    target: playOptions.target ?? null,
  });
  const runs = schedule.map((entry) => {
    const animation = model.animations.get(entry.id);
    const element = targetOf(entry, animation);
    return startRun(context, animation, element, entry.start, playOptions);
  });
  const control = createControl(context, runs);
  const run = ++context.nextRun;
  const recordedOptions = {
    ...playOptions,
    seed: playOptions.seed ?? context.seed ?? 0,
  };
  context.emit({ kind: 'play', id, run, options: recordedOptions });
  const cancel = control.cancel;
  let cancelled = false;
  control.cancel = () => {
    if (!cancelled) {
      cancelled = true;
      context.emit({ kind: 'cancel', id, run, options: recordedOptions });
    }
    cancel();
  };
  return control;
}

const isOn = (values) =>
  Array.isArray(values) && values.length > 0 && values[0] !== 'false';

/** `(on STATE (play ID [(target ID)]))` properties of a store element. */
function storeTriggers(store, id, state) {
  const out = [];
  for (const property of store.get(id)?.properties ?? []) {
    const [name, playLink] = property.values;
    const plays =
      property.name === 'on' &&
      name === state &&
      Array.isArray(playLink) &&
      playLink[0] === 'play';
    if (!plays) {
      continue;
    }
    const targetLink = playLink
      .slice(2)
      .find((v) => Array.isArray(v) && v[0] === 'target');
    out.push({
      state,
      element: id,
      animation: playLink[1],
      target: targetLink?.[1] ?? id,
    });
  }
  return out;
}

/**
 * The plays that fire when element `id` enters `state`: the model triggers
 * of that element (an animation's own `(on STATE)` fires on its target) and
 * the `(on STATE (play ...))` properties of the element in the store.
 * @returns {{ animation: string, target: string }[]}
 */
export function triggersFor(model, store, id, state) {
  const found = [
    ...model.triggers.filter((t) => t.state === state && t.element === id),
    ...storeTriggers(store, id, state),
  ];
  const seen = new Set();
  const out = [];
  for (const t of found) {
    const play = { animation: t.animation, target: t.target ?? t.element };
    const key = `${play.animation}@${play.target}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(play);
    }
  }
  return out;
}

/** The state of an update event that just turned on, or `null`. */
function enteredState(event) {
  const entered =
    event.origin !== 'replay' &&
    event.type === 'update' &&
    ANIMATION_STATES.includes(event.prop) &&
    isOn(event.after) &&
    !isOn(event.before);
  return entered ? event.prop : null;
}

function bindStore(context, store) {
  const { model } = context;
  const running = new Map();
  return store.subscribe((events) => {
    for (const event of events) {
      const state = enteredState(event);
      if (state === null) {
        continue;
      }
      for (const trigger of triggersFor(model, store, event.id, state)) {
        const known =
          model.animations.has(trigger.animation) ||
          model.timelines.has(trigger.animation);
        if (!known) {
          continue;
        }
        const key = `${trigger.animation}@${trigger.target}`;
        running.get(key)?.cancel();
        const run = playId(context, trigger.animation, {
          target: trigger.target,
        });
        running.set(key, run);
        run.finished
          .then(() => running.get(key) === run && running.delete(key))
          .catch(() => {});
      }
    }
  });
}

/**
 * @param {import('./types.js').ElementSource} handle
 * @param {import('./types.js').PlayerOptions} [options]
 * @returns {import('./types.js').Player}
 */
export function createPlayer(handle, options = {}) {
  const model = emptyModel();
  const motion = options.motion ?? defaultMotion;
  const listeners = new Set();
  const context = {
    nextRun: 0,
    emit: (event) => {
      for (const listener of listeners) {
        listener(event);
      }
    },
    model,
    clock: options.clock ?? systemClock(),
    animate:
      options.animate ??
      ((element, keyframes, timing) => element.animate(keyframes, timing)),
    isCss: options.isCssProperty ?? defaultIsCss,
    resolveToken: options.resolveToken,
    apply: options.apply ?? defaultApply,
    seed: options.seed,
    elementFor: elementLookup(handle),
    motionOf: (element) =>
      typeof motion === 'function' ? motion(element) : motion,
  };
  if (options.animations !== undefined) {
    loadInto(model, options.animations);
  }
  return {
    model,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** Merge animations (Links Notation text or a loaded model). */
    load: (source) => loadInto(model, source),
    /** Play an animation or a timeline. */
    play: (id, playOptions) => playId(context, id, playOptions),
    /**
     * Play the triggers of element states: when the store sets the
     * property named after a state (`pressed`, `hover`, `focus`,
     * `disabled`) to a value other than `false`, the animations of
     * `(on STATE ...)` play. A trigger that fires again cancels its
     * previous run first. Returns the unsubscribe function.
     */
    bindTriggers: (store) => bindStore(context, store),
    /** Whether an element plays the reduced-motion variants. */
    motion: (id) => context.motionOf(context.elementFor(id)),
  };
}
