/**
 * `loadAnimations(text)`: the animation model of Links Notation text.
 *
 * Text is read only by ui-core `parse` (the official `links-notation`
 * parser); this module reads the projected links of every `animation` and
 * `timeline` element, and the `(on STATE (play ID))` triggers of any element.
 *
 * ```
 * (NAME: animation (target ID) (duration 300ms) (delay 0ms)
 *   (iterations 1|infinite) (direction normal|reverse|alternate|alternate-reverse)
 *   (fill none|forwards|backwards|both) (composite replace|add|accumulate)
 *   (easing NAME|(cubic-bezier a b c d)|(steps n)|(spring (stiffness k) (damping c) (mass m)))
 *   (track PROPERTY (key OFFSET VALUE [EASING])...)
 *   (effect NAME (seed 42) (PARAM VALUE)...) (persist true) (envelope bell|sustain)
 *   (on hover|focus|pressed|disabled [(play ID [(target ID)])])
 *   (reduced-motion PART...))
 * (NAME: timeline (at TIME ITEM...) ITEM...)
 *   ITEM = (play ID [(target ID)] [(targets ID...)]) | (sequence ITEM...)
 *        | (parallel ITEM...) | (stagger STEP ITEM... [(targets ID...)])
 * ```
 */

import { parse, walk, values as coreValues } from '@link-foundation/ui-core';
import { animationDiagnostic } from './diagnostics.js';
import { isEasingName } from './easing.js';
import { readValue } from './values.js';
import { getEffect } from './effects.js';

const { parseDuration, parseNumber } = coreValues;

/** The element states that can trigger an animation. */
export const ANIMATION_STATES = Object.freeze([
  'hover',
  'focus',
  'pressed',
  'disabled',
]);

const DIRECTIONS = ['normal', 'reverse', 'alternate', 'alternate-reverse'];
const FILLS = ['none', 'forwards', 'backwards', 'both', 'auto'];
const COMPOSITES = ['replace', 'add', 'accumulate'];
const ENVELOPES = ['bell', 'sustain'];
const STEP_POSITIONS = {
  start: 'start',
  end: 'end',
  'jump-start': 'start',
  'jump-end': 'end',
  'jump-both': 'both',
  'jump-none': 'none',
};

/** Defaults of every animation field (WAAPI defaults, `fill none`). */
export const ANIMATION_DEFAULTS = Object.freeze({
  target: null,
  duration: null,
  delay: 0,
  iterations: 1,
  direction: 'normal',
  fill: 'none',
  composite: 'replace',
  easing: null,
  tracks: [],
  effect: null,
  persist: false,
  envelope: null,
});

/** The ui-core diagnostics this reader restates for its own elements. */
const RESTATED = new Set(['unknown-sublink', 'unknown-kind']);

const isAtom = (raw) => typeof raw === 'string';
const isLink = (raw) => Array.isArray(raw);
const show = (raw) =>
  isLink(raw) ? `(${raw.map(show).join(' ')})` : String(raw);

/** Every sublink of an element as `[name, ...values]`, declared or not. */
function sublinks(node) {
  return [
    ...node.properties.map((p) => [p.name, ...p.values]),
    ...node.unknown.filter(isLink),
  ];
}

/**
 * A reader of one element: collects diagnostics that point at it.
 */
class Reader {
  constructor(element, kind, diagnostics) {
    this.element = element;
    this.kind = kind;
    this.diagnostics = diagnostics;
  }

  report(code, severity, at = {}) {
    this.diagnostics.push(
      animationDiagnostic(code, severity, { element: this.element, ...at })
    );
  }

  invalid(property, raw, expected) {
    this.report('invalid-value', 'error', {
      property,
      text: show(raw),
      expected,
    });
  }

  /** A time in ms: `300ms`, `0.3s`, or a `(token PATH)` reference. */
  time(property, raw, { allowNegative = false } = {}) {
    if (isLink(raw) && raw[0] === 'token' && isAtom(raw[1])) {
      return { type: 'token', path: raw[1] };
    }
    const negative = allowNegative && isAtom(raw) && raw.startsWith('-');
    const text = negative ? raw.slice(1) : raw;
    const quantity = isAtom(text) ? parseDuration(text) : null;
    if (quantity === null) {
      this.invalid(property, raw, 'a duration such as 300ms or 0.3s');
      return undefined;
    }
    const ms = quantity.unit === 's' ? quantity.value * 1000 : quantity.value;
    return negative ? -ms : ms;
  }

  oneOf(property, raw, choices) {
    if (isAtom(raw) && choices.includes(raw)) {
      return raw;
    }
    this.invalid(property, raw, `one of ${choices.join(', ')}`);
    return undefined;
  }

  number(property, raw, { min = -Infinity } = {}) {
    const n = isAtom(raw) ? parseNumber(raw) : null;
    if (n === null || n < min) {
      this.invalid(property, raw, `a number >= ${min}`);
      return undefined;
    }
    return n;
  }

  /** An easing: a name or a `cubic-bezier`, `steps` or `spring` link. */
  easing(raw) {
    if (isAtom(raw)) {
      if (!isEasingName(raw)) {
        this.report('unknown-easing', 'warning', { text: raw });
      }
      return raw === 'linear'
        ? { type: 'linear' }
        : { type: 'named', name: raw };
    }
    const [head, ...args] = isLink(raw) ? raw : [];
    if (head === 'cubic-bezier') {
      return this.bezier(raw, args);
    }
    if (head === 'steps') {
      return this.steps(raw, args);
    }
    if (head === 'spring') {
      return this.spring(raw, args);
    }
    this.report('unknown-easing', 'error', { text: show(raw) });
    return undefined;
  }

  bezier(raw, args) {
    const points = args.map((a) => (isAtom(a) ? parseNumber(a) : null));
    const xOk = (x) => x !== null && x >= 0 && x <= 1;
    if (
      points.length !== 4 ||
      points.includes(null) ||
      !xOk(points[0]) ||
      !xOk(points[2])
    ) {
      this.invalid('easing', raw, '(cubic-bezier x1 y1 x2 y2), x in 0..1');
      return undefined;
    }
    return { type: 'cubic-bezier', points };
  }

  steps(raw, [count, position = 'end', ...rest]) {
    const n = isAtom(count) ? parseNumber(count) : null;
    const where = isAtom(position) ? STEP_POSITIONS[position] : undefined;
    if (
      n === null ||
      !Number.isInteger(n) ||
      n < 1 ||
      where === undefined ||
      rest.length > 0 ||
      (where === 'none' && n < 2)
    ) {
      this.invalid('easing', raw, '(steps N [start|end|jump-both|jump-none])');
      return undefined;
    }
    return { type: 'steps', count: n, position: where };
  }

  spring(raw, args) {
    const spring = { type: 'spring', stiffness: 100, damping: 10, mass: 1 };
    for (const arg of args) {
      const [name, value] = isLink(arg) ? arg : [];
      if (!['stiffness', 'damping', 'mass'].includes(name)) {
        this.invalid(
          'easing',
          raw,
          '(spring (stiffness k) (damping c) (mass m))'
        );
        return undefined;
      }
      const n = this.number(`spring ${name}`, value, { min: 0 });
      if (n === undefined) {
        return undefined;
      }
      spring[name] = n;
    }
    if (!(spring.stiffness > 0 && spring.mass > 0 && spring.damping > 0)) {
      this.invalid(
        'easing',
        raw,
        'a spring with positive stiffness, damping and mass'
      );
      return undefined;
    }
    return spring;
  }

  /** `(track PROPERTY (key OFFSET VALUE [EASING])...)` */
  track(raw) {
    const [property, ...keys] = raw;
    if (!isAtom(property)) {
      this.invalid('track', raw, '(track PROPERTY (key OFFSET VALUE)...)');
      return undefined;
    }
    const track = { property, keys: [] };
    let last = -Infinity;
    for (const key of keys) {
      const parsed = this.key(property, key);
      if (parsed === undefined) {
        continue;
      }
      if (parsed.offset < last) {
        this.report('key-offset-order', 'error', {
          track: property,
          text: show(key[1]),
        });
      }
      last = Math.max(last, parsed.offset);
      track.keys.push(parsed);
    }
    if (keys.length === 0) {
      this.report('empty-track', 'error', { track: property });
    }
    return track;
  }

  key(property, raw) {
    if (!isLink(raw) || raw[0] !== 'key' || raw.length < 3 || raw.length > 4) {
      this.invalid(`track ${property}`, raw, '(key OFFSET VALUE [EASING])');
      return undefined;
    }
    const [, offsetRaw, valueRaw, easingRaw] = raw;
    const offset = isAtom(offsetRaw) ? parseNumber(offsetRaw) : null;
    if (offset === null || offset < 0 || offset > 1) {
      this.report('key-offset-range', 'error', {
        track: property,
        text: show(offsetRaw),
      });
      return undefined;
    }
    const value = readValue(valueRaw);
    if (value === null) {
      this.invalid(
        `track ${property}`,
        valueRaw,
        'a number, colour, text or (token PATH)'
      );
      return undefined;
    }
    const key = { offset, value, easing: null };
    if (easingRaw !== undefined) {
      key.easing = this.easing(easingRaw) ?? null;
    }
    return key;
  }

  /** `(effect NAME (PARAM VALUE)...)` */
  effect(raw) {
    const [name, ...params] = raw;
    if (!isAtom(name)) {
      this.invalid('effect', raw, '(effect NAME (PARAM VALUE)...)');
      return undefined;
    }
    if (getEffect(name) === undefined) {
      this.report('unknown-effect', 'warning', { text: name });
    }
    const effect = { name, params: {} };
    for (const param of params) {
      const [key, value] = isLink(param) ? param : [];
      if (!isAtom(key) || !isAtom(value) || param.length !== 2) {
        this.invalid('effect', param, '(PARAM VALUE)');
        continue;
      }
      effect.params[key] = parseNumber(value) ?? value;
    }
    return effect;
  }

  /** `(envelope bell|sustain [(attack 100ms)] [(release 100ms)])` */
  envelope(raw) {
    const [type, ...parts] = raw;
    if (this.oneOf('envelope', type, ENVELOPES) === undefined) {
      return undefined;
    }
    const envelope = { type };
    for (const part of parts) {
      const [name, value] = isLink(part) ? part : [];
      if (type !== 'sustain' || !['attack', 'release'].includes(name)) {
        this.invalid(
          'envelope',
          part,
          '(attack TIME) or (release TIME) of a sustain envelope'
        );
        continue;
      }
      const ms = this.time(`envelope ${name}`, value);
      if (typeof ms === 'number') {
        envelope[name] = ms;
      }
    }
    return envelope;
  }

  /** `(on STATE [(play ID [(target ID)])])`; `null` when STATE is not a state. */
  trigger(raw, { strict }) {
    const [state, play] = raw;
    if (!ANIMATION_STATES.includes(state)) {
      if (strict) {
        this.report('unknown-state', 'warning', { text: show(state) });
      }
      return null;
    }
    if (play === undefined) {
      return { state, animation: null, target: null };
    }
    const [head, id, ...rest] = isLink(play) ? play : [];
    if (head !== 'play' || !isAtom(id)) {
      if (strict) {
        this.invalid('on', play, '(play ID [(target ID)])');
      }
      return null;
    }
    const target = rest.find((r) => isLink(r) && r[0] === 'target')?.[1];
    return { state, animation: id, target: isAtom(target) ? target : null };
  }
}

const FIELD_READERS = {
  target: (r, [v]) => (isAtom(v) ? v : r.invalid('target', v, 'an element id')),
  duration: (r, [v]) => r.time('duration', v),
  delay: (r, [v]) => r.time('delay', v, { allowNegative: true }),
  iterations: (r, [v]) =>
    v === 'infinite' ? Infinity : r.number('iterations', v, { min: 0 }),
  direction: (r, [v]) => r.oneOf('direction', v, DIRECTIONS),
  fill: (r, [v]) => r.oneOf('fill', v, FILLS),
  composite: (r, [v]) => r.oneOf('composite', v, COMPOSITES),
  easing: (r, [v]) => r.easing(v),
  effect: (r, values) => r.effect(values),
  persist: (r, [v]) =>
    v === 'true'
      ? true
      : v === 'false'
        ? false
        : r.invalid('persist', v, 'true or false'),
  envelope: (r, values) => r.envelope(values),
};

/**
 * The fields of an animation (or of its reduced-motion block): only the
 * fields that are written are set.
 */
function readFields(reader, links, { nested }) {
  const fields = {};
  const triggers = [];
  let reduced = null;
  for (const [name, ...values] of links) {
    if (name === 'track') {
      const track = reader.track(values);
      if (track) {
        (fields.tracks ??= []).push(track);
      }
    } else if (Object.hasOwn(FIELD_READERS, name)) {
      const value = FIELD_READERS[name](reader, values);
      if (value !== undefined) {
        fields[name] = value;
      }
    } else if (name === 'on' && !nested) {
      const trigger = reader.trigger(values, { strict: true });
      if (trigger) {
        triggers.push(trigger);
      }
    } else if (name === 'reduced-motion' && !nested) {
      reduced = readFields(reader, values.filter(isLink), {
        nested: true,
      }).fields;
    } else {
      reader.report('unknown-sublink', 'warning', {
        kind: nested ? 'reduced-motion block' : 'animation',
        text: show(name),
      });
    }
  }
  return { fields, triggers, reduced };
}

function readAnimation(node, diagnostics) {
  const reader = new Reader(node.id, 'animation', diagnostics);
  const { fields, triggers, reduced } = readFields(reader, sublinks(node), {
    nested: false,
  });
  const animation = {
    id: node.id,
    kind: 'animation',
    ...ANIMATION_DEFAULTS,
    tracks: [],
    ...fields,
    triggers,
    reducedMotion: reduced,
  };
  return animation;
}

/** One timeline item, or `undefined` (reported) when it is invalid. */
function readItem(reader, raw) {
  const [head, ...args] = isLink(raw) ? raw : [];
  const items = () =>
    args
      .filter((a) => !(isLink(a) && a[0] === 'targets'))
      .map((a) => readItem(reader, a))
      .filter(Boolean);
  const targets = () => {
    const link = args.find((a) => isLink(a) && a[0] === 'targets');
    return link ? link.slice(1).filter(isAtom) : null;
  };
  switch (head) {
    case 'play': {
      const [id, ...rest] = args;
      if (!isAtom(id)) {
        break;
      }
      const target = rest.find((r) => isLink(r) && r[0] === 'target')?.[1];
      return {
        type: 'play',
        id,
        target: isAtom(target) ? target : null,
        targets: targets(),
      };
    }
    case 'sequence':
    case 'parallel':
      return { type: head, items: items() };
    case 'at':
    case 'stagger': {
      const time = reader.time(head, args.shift(), {
        allowNegative: head === 'at',
      });
      if (time === undefined) {
        return undefined;
      }
      const item = { type: head, items: items() };
      item[head === 'at' ? 'time' : 'step'] = time;
      if (head === 'stagger') {
        item.targets = targets();
      }
      return item;
    }
    default:
      break;
  }
  reader.invalid(
    'timeline item',
    raw,
    '(at TIME ITEM...), (play ID), (sequence ...), (parallel ...) or (stagger STEP ...)'
  );
  return undefined;
}

function readTimeline(node, diagnostics) {
  const reader = new Reader(node.id, 'timeline', diagnostics);
  const items = sublinks(node)
    .map((link) => readItem(reader, link))
    .filter(Boolean);
  return { id: node.id, kind: 'timeline', items };
}

/** Every `(play ID)` of a timeline item tree. */
function playsOf(items, out = []) {
  for (const item of items) {
    if (item.type === 'play') {
      out.push(item.id);
    } else {
      playsOf(item.items, out);
    }
  }
  return out;
}

/** Report unknown `play` targets and cycles between timelines. */
function checkReferences(model, diagnostics) {
  const known = (id) => model.animations.has(id) || model.timelines.has(id);
  for (const timeline of model.timelines.values()) {
    for (const id of playsOf(timeline.items)) {
      if (!known(id)) {
        diagnostics.push(
          animationDiagnostic('unknown-animation', 'error', {
            element: timeline.id,
            property: 'timeline',
            text: id,
          })
        );
      }
    }
    const cycle = findCycle(model, timeline.id);
    if (cycle) {
      diagnostics.push(
        animationDiagnostic('timeline-cycle', 'error', {
          element: timeline.id,
          text: cycle.join(' -> '),
        })
      );
    }
  }
  for (const trigger of model.triggers) {
    if (!known(trigger.animation)) {
      diagnostics.push(
        animationDiagnostic('unknown-animation', 'error', {
          element: trigger.element,
          property: `trigger ${trigger.state}`,
          text: trigger.animation,
        })
      );
    }
  }
}

/** The path back to `start` through nested timelines, or `null`. */
function findCycle(model, start) {
  const visit = (id, path) => {
    const timeline = model.timelines.get(id);
    if (!timeline) {
      return null;
    }
    for (const next of playsOf(timeline.items)) {
      if (next === start) {
        return [...path, next];
      }
      if (!path.includes(next)) {
        const found = visit(next, [...path, next]);
        if (found) {
          return found;
        }
      }
    }
    return null;
  };
  return visit(start, [start]);
}

/**
 * Read the animations, timelines and state triggers of Links Notation text.
 * Never throws: every problem is a diagnostic.
 * @param {string} text
 * @returns {import('./types.js').AnimationModel}
 */
export function loadAnimations(text) {
  const document = parse(text, { checks: false });
  const own = new Set();
  const diagnostics = [];
  const model = {
    animations: new Map(),
    timelines: new Map(),
    triggers: [],
    diagnostics,
  };
  walk(document, (node) => {
    if (node.kind === 'animation' || node.kind === 'timeline') {
      own.add(node.id);
      if (node.id === null) {
        diagnostics.push(
          animationDiagnostic('anonymous-animation', 'warning', {})
        );
        return false;
      }
      if (node.kind === 'animation') {
        const animation = readAnimation(node, diagnostics);
        model.animations.set(node.id, animation);
        for (const t of animation.triggers) {
          // `(on STATE ...)` of an animation fires on the state of its
          // target and plays there unless the play names another target.
          model.triggers.push({
            state: t.state,
            element: animation.target ?? node.id,
            animation: t.animation ?? node.id,
            target: t.target ?? animation.target,
          });
        }
      } else {
        model.timelines.set(node.id, readTimeline(node, diagnostics));
      }
      return false;
    }
    readElementTriggers(node, model, diagnostics);
    return undefined;
  });
  const restated = (d) => RESTATED.has(d.code) && own.has(d.at?.element);
  diagnostics.unshift(...document.diagnostics.filter((d) => !restated(d)));
  checkReferences(model, diagnostics);
  return model;
}

/** `(on STATE (play ID [(target ID)]))` on any other element. */
function readElementTriggers(node, model, diagnostics) {
  const reader = new Reader(node.id, node.kind, diagnostics);
  for (const property of node.properties) {
    if (property.name !== 'on') {
      continue;
    }
    const trigger = reader.trigger(property.values, { strict: false });
    if (trigger && trigger.animation) {
      model.triggers.push({
        state: trigger.state,
        element: node.id,
        animation: trigger.animation,
        target: trigger.target ?? node.id,
      });
    }
  }
}
