/**
 * Run a machine: a DOM-free interpreter of the flat state machines read by
 * `parseMachine`. Events go in with `send`, state and context come out by
 * `subscribe` and `attrs(part)`. Every effect is data: `(set NAME VALUE)`
 * and `(toggle NAME)` change the context, a machine action expands to its
 * steps, and any other action name is dispatched through the actions
 * registry, where an unknown name is a diagnostic — nothing is evaluated.
 * Time comes from an injected clock, so `(after 500ms ...)` is testable
 * without waiting.
 */

import { createActionRegistry } from './actions.js';
import { diagnostic } from './diagnostics.js';
import { createMachine, toValue } from './parse-machine.js';

/**
 * @typedef {import('./parse-machine.js').Machine} Machine
 * @typedef {import('./parse-machine.js').Action} Action
 * @typedef {import('./parse-machine.js').Transition} Transition
 * @typedef {import('./parse-machine.js').RawValue} RawValue
 * @typedef {import('./actions.js').ActionRegistry} ActionRegistry
 * @typedef {import('./actions.js').ActionFn} ActionFn
 * @typedef {ReturnType<typeof diagnostic>} Diagnostic
 *
 * @typedef {{type: string, [key: string]: unknown}} MachineEvent
 *
 * @typedef {(context: Readonly<Record<string, unknown>>,
 *   event: MachineEvent) => boolean} Guard
 *
 * @typedef {object} Clock  where `after` timers come from
 * @property {(fn: () => void, ms: number) => unknown} setTimeout
 * @property {(handle: unknown) => void} clearTimeout
 *
 * @typedef {object} Snapshot
 * @property {string} state
 * @property {Readonly<Record<string, unknown>>} context
 * @property {MachineEvent|null} event  what caused the change
 *
 * @typedef {object} Service
 * @property {Machine} machine
 * @property {string} state  the current state
 * @property {Readonly<Record<string, unknown>>} context  the current
 *   context (a frozen copy)
 * @property {'running'|'stopped'} status
 * @property {(event: string | MachineEvent) => boolean} send  `true` when
 *   a transition was taken
 * @property {(event: string | MachineEvent) => boolean} can  whether
 *   `send(event)` would take a transition now
 * @property {(fn: (snapshot: Snapshot) => void) => () => void} subscribe
 *   called after every change; returns the unsubscribe function
 * @property {(patch: Record<string, unknown>) => void} assign  change the
 *   context from outside (a host property, say)
 * @property {(effects: Record<string, Function>) => () => void} use  add
 *   host effects (such as `focus`) for the actions; returns their removal
 * @property {(part: string) => Record<string, string>} attrs  the
 *   attributes of a part in the current state and context
 * @property {() => void} stop  clear the timers and ignore later events
 */

/** The built-in guards; a `guards` option of the same name wins. */
const BUILT_IN_GUARDS = Object.freeze({
  'not-disabled': (context) => context.disabled !== true,
});

/** How deep machine actions may expand into each other. */
const MAX_DEPTH = 32;

/** A clock on the global timers, read when a timer is set. */
const globalClock = Object.freeze({
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (handle) => globalThis.clearTimeout(handle),
});

/**
 * A clock that only moves when told to, for tests and for replaying a
 * recorded session: `advance(ms)` runs every timer that falls due, in order.
 * @returns {Clock & {now: number, advance: (ms: number) => void,
 *   pending: () => number}}
 */
export function createManualClock() {
  let now = 0;
  let nextId = 1;
  /** @type {Map<number, {at: number, fn: () => void}>} */
  const timers = new Map();
  return {
    get now() {
      return now;
    },
    setTimeout(fn, ms = 0) {
      const id = nextId++;
      timers.set(id, { at: now + Math.max(0, Number(ms) || 0), fn });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    pending: () => timers.size,
    advance(ms) {
      const end = now + ms;
      for (;;) {
        let due = null;
        for (const [id, timer] of timers) {
          if (timer.at <= end && (due === null || timer.at < due[1].at)) {
            due = [id, timer];
          }
        }
        if (due === null) {
          break;
        }
        timers.delete(due[0]);
        now = due[1].at;
        due[1].fn();
      }
      now = end;
    },
  };
}

/** The registry for an `actions` option: a registry, a map or nothing. */
function registryOf(actions, onDiagnostic) {
  if (actions && typeof actions.dispatch === 'function') {
    return actions;
  }
  const registry = createActionRegistry({ onDiagnostic });
  for (const [name, fn] of Object.entries(actions ?? {})) {
    registry.register(name, fn);
  }
  return registry;
}

const toEvent = (event) =>
  typeof event === 'string' ? { type: event } : { ...event };

const isName = (value) => typeof value === 'string' && value !== '';

/**
 * The text of an attribute value form in a state and context, or `null`
 * to leave the attribute out:
 *
 * - an atom: the atom itself;
 * - `(context NAME)`: the context value as text;
 * - `(in STATE...)`: `'true'` in one of the states, else `'false'`;
 * - `(not FORM)`: the opposite of a `'true'`/`'false'` form;
 * - `(present FORM)`: `''` (a boolean attribute) when the form is `'true'`;
 * - `(state)`: the state name.
 * @param {RawValue} raw
 * @param {string} state
 * @param {Readonly<Record<string, unknown>>} context
 * @returns {string|null}
 */
export function attrValue(raw, state, context) {
  if (typeof raw === 'string') {
    return raw;
  }
  if (!Array.isArray(raw)) {
    return null;
  }
  const [head, ...rest] = raw;
  const inner = () => attrValue(rest[0] ?? 'false', state, context);
  switch (head) {
    case 'context': {
      const value = context[rest[0]];
      return value === undefined || value === null ? null : String(value);
    }
    case 'in':
      return String(rest.includes(state));
    case 'not': {
      const value = inner();
      return value === null ? null : String(value !== 'true');
    }
    case 'present':
      return inner() === 'true' ? '' : null;
    case 'state':
      return state;
    default:
      return null;
  }
}

/**
 * Whether every guard passes. An unknown guard and a guard that throws
 * block the transition (fail closed) and are reported.
 */
function guardsPass(names, guards, context, event, report) {
  return names.every((name) => {
    const guard = guards[name];
    if (typeof guard !== 'function') {
      report('unknown-guard', 'warning', { guard: name });
      return false;
    }
    try {
      return guard(context, event) === true;
    } catch (error) {
      report('guard-error', 'error', {
        guard: name,
        error: String(error?.message ?? error),
      });
      return false;
    }
  });
}

/** Whether an event would take a transition now (no diagnostics). */
const canTake = (node, event, guards, context) =>
  (node.on[event.type] ?? []).some((t) =>
    guardsPass(t.guards, guards, context, event, () => {})
  );

/** The attributes of a part (`attrValue` of each, `null` left out). */
function partAttrs(part, state, context) {
  const attrs = {};
  for (const { name, value } of part?.attrs ?? []) {
    const text = attrValue(value, state, context);
    if (text !== null) {
      attrs[name] = text;
    }
  }
  return attrs;
}

/** Host effects (`use`): added in layers, each removable on its own. */
function createEffects() {
  let effects = Object.freeze({});
  return {
    get current() {
      return effects;
    },
    use(more) {
      effects = Object.freeze({ ...effects, ...more });
      return () => {
        const rest = { ...effects };
        for (const [name, fn] of Object.entries(more)) {
          if (rest[name] === fn) {
            delete rest[name];
          }
        }
        effects = Object.freeze(rest);
      };
    },
  };
}

/** The pending `after` timers of the current state. */
function createTimers(clock) {
  const handles = new Set();
  return {
    set(fn, ms) {
      const handle = clock.setTimeout(() => {
        handles.delete(handle);
        fn();
      }, ms);
      handles.add(handle);
    },
    clear() {
      for (const handle of handles) {
        clock.clearTimeout(handle);
      }
      handles.clear();
    },
  };
}

/** Check a machine argument; LiNo text is read with `createMachine`. */
function machineOf(machine) {
  const spec = typeof machine === 'string' ? createMachine(machine) : machine;
  if (!spec || typeof spec !== 'object' || !spec.states) {
    throw new TypeError('interpret: expected a machine from parseMachine');
  }
  if (!Object.hasOwn(spec.states, spec.initial ?? '')) {
    throw new TypeError(
      `interpret: machine ${JSON.stringify(spec.id)} has no valid initial state`
    );
  }
  return spec;
}

/**
 * Start a machine.
 * @param {Machine | string} machine  a machine from `parseMachine`, or LiNo
 *   text (read with `createMachine`, which throws on errors)
 * @param {object} [options]
 * @param {ActionRegistry | Record<string, ActionFn>} [options.actions]  a
 *   registry, or actions to register in a new one with the vocabulary
 *   defaults
 * @param {Record<string, Guard>} [options.guards]
 * @param {Clock} [options.clock]  defaults to the global timers
 * @param {Record<string, unknown>} [options.context]  overrides the
 *   initial context
 * @param {(d: Diagnostic) => void} [options.onDiagnostic]
 * @returns {Service}
 */
export function interpret(machine, options = {}) {
  const spec = machineOf(machine);
  const onDiagnostic = options.onDiagnostic ?? (() => {});
  const report = (code, severity, at) =>
    onDiagnostic(diagnostic(code, severity, { machine: spec.id, ...at }));
  const registry = registryOf(options.actions, onDiagnostic);
  const guards = { ...BUILT_IN_GUARDS, ...options.guards };
  const timers = createTimers(options.clock ?? globalClock);
  const effects = createEffects();
  const listeners = new Set();
  const queue = [];

  let state = spec.initial;
  let context = Object.freeze({ ...spec.context, ...options.context });
  let status = 'running';
  let changed = false;
  let busy = false;

  const setContext = (patch) => {
    context = Object.freeze({ ...context, ...patch });
    changed = true;
  };

  const notify = (event) => {
    if (changed) {
      changed = false;
      const snapshot = Object.freeze({ state, context, event });
      [...listeners].forEach((listener) => listener(snapshot));
    }
  };

  /** Run one action step: a machine action, a context op or a registry name. */
  const run = (action, event, depth) => {
    const { type, args } = action;
    if (args.length === 0 && Object.hasOwn(spec.actions, type)) {
      if (depth >= MAX_DEPTH) {
        report('action-error', 'error', {
          action: type,
          error: 'machine actions expand too deep',
        });
        return;
      }
      spec.actions[type].forEach((step) => run(step, event, depth + 1));
    } else if (type === 'set' && args.length === 2 && isName(args[0])) {
      setContext({ [args[0]]: toValue(args[1]) });
    } else if (type === 'toggle' && args.length === 1 && isName(args[0])) {
      setContext({ [args[0]]: context[args[0]] !== true });
    } else {
      registry.dispatch(type, args, {
        source: spec.id,
        event: event.type,
        state,
        context,
        assign: (patch) => setContext({ ...patch }),
        effects: effects.current,
      });
    }
  };

  const runAll = (actions, event) =>
    actions.forEach((action) => run(action, event, 0));

  /** Schedule the `after` transitions of the current state. */
  const schedule = () => {
    for (const delayed of spec.states[state].after) {
      timers.set(() => {
        if (status === 'running') {
          process({ type: `after:${delayed.delay}` }, [delayed]);
        }
      }, delayed.delay);
    }
  };

  const take = (transition, event) => {
    if (transition.target === null) {
      runAll(transition.actions, event);
      return;
    }
    runAll(spec.states[state].exit, event);
    timers.clear();
    runAll(transition.actions, event);
    state = transition.target;
    changed = true;
    runAll(spec.states[state].entry, event);
    schedule();
  };

  /** Handle one event; events sent by actions are queued and run after it. */
  function process(event, candidates) {
    if (busy) {
      queue.push([event, candidates]);
      return false;
    }
    busy = true;
    let taken = false;
    try {
      for (
        let next = [event, candidates];
        next !== undefined && status === 'running';
        next = queue.shift()
      ) {
        const [current, list] = next;
        const transitions = list ?? spec.states[state].on[current.type] ?? [];
        const transition = transitions.find((t) =>
          guardsPass(t.guards, guards, context, current, report)
        );
        if (transition) {
          take(transition, current);
          taken ||= current === event;
        }
        notify(current);
      }
    } finally {
      busy = false;
      queue.length = 0;
    }
    return taken;
  }

  // Enter the initial state.
  busy = true;
  try {
    runAll(spec.states[state].entry, { type: 'init' });
    schedule();
  } finally {
    busy = false;
    changed = false;
  }

  return Object.freeze({
    machine: spec,
    get state() {
      return state;
    },
    get context() {
      return context;
    },
    get status() {
      return status;
    },
    send: (event) => status === 'running' && process(toEvent(event)),
    can: (event) =>
      status === 'running' &&
      canTake(spec.states[state], toEvent(event), guards, context),
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    assign(patch) {
      if (status === 'running') {
        setContext({ ...patch });
        notify({ type: 'assign' });
      }
    },
    use: (more) => effects.use(more),
    attrs: (part) => partAttrs(spec.parts[part], state, context),
    stop() {
      status = 'stopped';
      timers.clear();
      queue.length = 0;
    },
  });
}
