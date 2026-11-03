/**
 * Read a behaviour state machine written in Links Notation into a plain,
 * serialisable machine object. Text is read only by ui-core `parse` (the
 * official `links-notation` parser); this module walks the links it
 * returns and never evaluates any value.
 *
 * ```lino
 * (toggle-machine: machine
 *   (initial off)
 *   (context (pressed false))
 *   (action set-pressed (set pressed true))
 *   (state off (on toggle (target on) (do set-pressed) (when not-disabled)))
 *   (state on (on toggle (target off) (do (set pressed false))))
 *   (part root (attr aria-pressed (context pressed)) (key Enter toggle)))
 * ```
 *
 * States are flat: nested, parallel and history states are future work.
 */

import { parse } from '@link-foundation/ui-core';
import { diagnostic } from './diagnostics.js';

/**
 * @typedef {string | RawValue[]} RawValue  a ui-core raw value
 *
 * @typedef {object} Action  a step of a transition, an entry or an exit
 * @property {string} type  the action name (`set`, `toggle`, a machine
 *   action or a registry name)
 * @property {RawValue[]} args
 *
 * @typedef {object} Transition
 * @property {string|null} target  the next state; `null` keeps the state
 *   (an internal transition: actions only, no exit or entry)
 * @property {Action[]} actions  the `(do ...)` actions, in order
 * @property {string[]} guards  the `(when ...)` guard names; all must pass
 *
 * @typedef {Transition & {delay: number}} DelayedTransition
 *
 * @typedef {object} StateNode
 * @property {Action[]} entry
 * @property {Action[]} exit
 * @property {Record<string, Transition[]>} on  transitions by event; the
 *   first one whose guards pass is taken
 * @property {DelayedTransition[]} after
 *
 * @typedef {object} PartSpec
 * @property {{name: string, value: RawValue}[]} attrs  `(attr NAME VALUE)`
 * @property {{key: string, event: string}[]} keys  `(key KEY EVENT)`
 * @property {{event: string, send: string}[]} events  `(on EVENT SEND)`:
 *   a UI event of the part element (`press`, `focus`, ...) sends a
 *   machine event
 *
 * @typedef {object} Machine
 * @property {string|null} id
 * @property {string|null} initial
 * @property {Record<string, unknown>} context  the initial context
 * @property {Record<string, Action[]>} actions  machine actions:
 *   `(action NAME STEP...)`, a name for a list of steps
 * @property {Record<string, StateNode>} states
 * @property {Record<string, PartSpec>} parts
 *
 * @typedef {ReturnType<typeof diagnostic>} Diagnostic
 */

/**
 * The value of a context atom: `true`, `false` and decimal numbers are
 * typed, every other atom stays text, and a link stays a list.
 * @param {RawValue} raw
 * @returns {unknown}
 */
export function toValue(raw) {
  if (Array.isArray(raw)) {
    return raw.map(toValue);
  }
  if (typeof raw !== 'string') {
    return raw;
  }
  if (raw === 'true' || raw === 'false') {
    return raw === 'true';
  }
  const number = raw.trim() === '' ? NaN : Number(raw);
  return Number.isFinite(number) ? number : raw;
}

const UNITS = [
  ['ms', 1],
  ['s', 1000],
];

/**
 * A delay in milliseconds: `500ms`, `2s` or a number of milliseconds;
 * `NaN` when it is none of these.
 * @param {RawValue} raw
 */
export function parseDelay(raw) {
  if (typeof raw !== 'string') {
    return NaN;
  }
  for (const [unit, factor] of UNITS) {
    if (raw.endsWith(unit)) {
      const amount = raw.slice(0, -unit.length);
      return amount === '' ? NaN : toDelay(Number(amount) * factor);
    }
  }
  return raw === '' ? NaN : toDelay(Number(raw));
}

const toDelay = (ms) => (Number.isFinite(ms) && ms >= 0 ? ms : NaN);

/** Every sublink of a node as `[head, ...values]`, properties first. */
function entriesOf(node) {
  const entries = (node.properties ?? []).map((p) => [p.name, ...p.values]);
  for (const raw of node.unknown ?? []) {
    if (Array.isArray(raw) && typeof raw[0] === 'string') {
      entries.push(raw);
    }
  }
  return entries;
}

/** Split `[head, ...values]` sublinks of a link (atoms are skipped). */
const linksOf = (values) =>
  values.filter((v) => Array.isArray(v) && typeof v[0] === 'string');

/** Read the actions of a `(do ...)`, `(entry ...)` or `(exit ...)`. */
function readActions(values, report) {
  const actions = [];
  for (const value of values) {
    if (typeof value === 'string') {
      actions.push({ type: value, args: [] });
    } else if (Array.isArray(value) && typeof value[0] === 'string') {
      actions.push({ type: value[0], args: value.slice(1) });
    } else {
      report('invalid-action', 'error', {});
    }
  }
  return actions;
}

/** Read `(target T)`, `(do ...)` and `(when ...)` of a transition. */
function readTransition(links, report, at) {
  const transition = { target: null, actions: [], guards: [] };
  for (const [head, ...values] of links) {
    if (head === 'target' && typeof values[0] === 'string') {
      transition.target = values[0];
    } else if (head === 'do') {
      transition.actions.push(...readActions(values, report));
    } else if (head === 'when') {
      transition.guards.push(...values.filter((v) => typeof v === 'string'));
    } else {
      report('unknown-field', 'warning', { ...at, field: head });
    }
  }
  return transition;
}

/** Read `(state NAME (on ...) (entry ...) (exit ...) (after ...))`. */
function readState(name, values, report) {
  const state = { entry: [], exit: [], on: {}, after: [] };
  const at = { state: name };
  for (const [head, ...rest] of linksOf(values)) {
    if (head === 'entry' || head === 'exit') {
      state[head].push(...readActions(rest, report));
    } else if (head === 'on') {
      const [event, ...links] = rest;
      if (typeof event !== 'string') {
        report('invalid-transition', 'error', at);
        continue;
      }
      const transition = readTransition(linksOf(links), report, at);
      (state.on[event] ??= []).push(transition);
    } else if (head === 'after') {
      const [delay, ...links] = rest;
      const ms = parseDelay(delay);
      if (Number.isNaN(ms)) {
        report('invalid-delay', 'error', { ...at, delay: String(delay) });
        continue;
      }
      state.after.push({
        delay: ms,
        ...readTransition(linksOf(links), report, at),
      });
    } else {
      report('unknown-field', 'warning', { ...at, field: head });
    }
  }
  return state;
}

/** Read `(part NAME (attr ...) (key ...) (on ...))`. */
function readPart(values, report) {
  const part = { attrs: [], keys: [], events: [] };
  for (const [head, ...rest] of linksOf(values)) {
    const [first, second] = rest;
    if (head === 'attr' && typeof first === 'string' && rest.length === 2) {
      part.attrs.push({ name: first, value: second });
    } else if (
      (head === 'key' || head === 'on') &&
      typeof first === 'string' &&
      typeof second === 'string'
    ) {
      if (head === 'key') {
        part.keys.push({ key: first, event: second });
      } else {
        part.events.push({ event: first, send: second });
      }
    } else {
      report('unknown-field', 'warning', { field: head });
    }
  }
  return part;
}

/** Read `(context (name value) ...)` into an object. */
function readContext(values, context) {
  for (const link of linksOf(values)) {
    const [name, ...rest] = link;
    context[name] =
      rest.length === 1 ? toValue(rest[0]) : rest.map((v) => toValue(v));
  }
}

/** Report transitions to states that do not exist. */
function checkTargets(machine, report) {
  for (const [name, state] of Object.entries(machine.states)) {
    const transitions = [...Object.values(state.on).flat(), ...state.after];
    for (const { target } of transitions) {
      if (target !== null && !Object.hasOwn(machine.states, target)) {
        report('unknown-target', 'error', { state: name, target });
      }
    }
  }
  if (machine.initial === null) {
    report('missing-initial', 'error', {});
  } else if (!Object.hasOwn(machine.states, machine.initial)) {
    report('unknown-initial', 'error', { state: machine.initial });
  }
}

/** The fields that declare a named state, action or part. */
const NAMED = new Set(['state', 'action', 'part']);

/** Read `(state NAME ...)`, `(action NAME ...)` or `(part NAME ...)`. */
function readNamed(machine, head, [name, ...rest], report) {
  if (head === 'state') {
    if (Object.hasOwn(machine.states, name)) {
      report('duplicate-state', 'error', { state: name });
    } else {
      machine.states[name] = readState(name, rest, report);
    }
  } else if (head === 'action') {
    if (Object.hasOwn(machine.actions, name)) {
      report('duplicate-action', 'error', { action: name });
    }
    machine.actions[name] = readActions(rest, report);
  } else {
    machine.parts[name] = readPart(rest, report);
  }
}

/** Read one machine element (a ui-core node or a store element view). */
function readMachine(node, diagnostics) {
  const id = node.id ?? null;
  const report = (code, severity, at) =>
    diagnostics.push(diagnostic(code, severity, { machine: id, ...at }));
  /** @type {Machine} */
  const machine = {
    id,
    initial: null,
    context: {},
    actions: {},
    states: {},
    parts: {},
  };
  for (const [head, ...values] of entriesOf(node)) {
    if (head === 'initial' && typeof values[0] === 'string') {
      machine.initial = values[0];
    } else if (head === 'context') {
      readContext(values, machine.context);
    } else if (NAMED.has(head) && typeof values[0] === 'string') {
      readNamed(machine, head, values, report);
    } else if (head !== 'note' && head !== 'machine') {
      report('unknown-field', 'warning', { field: head });
    }
  }
  checkTargets(machine, report);
  return machine;
}

/** The candidate nodes of a source: text, a ui-core document or a node. */
function nodesOf(source, diagnostics, options) {
  if (typeof source === 'string') {
    const document = parse(source, options.parseOptions);
    diagnostics.push(...document.diagnostics);
    return document.roots;
  }
  if (source !== null && typeof source === 'object') {
    return Array.isArray(source.roots) ? source.roots : [source];
  }
  return [];
}

/**
 * Read every `machine` element of a source.
 * @param {string | object} source  LiNo text, a ui-core document, or one
 *   node (a ui-core node or a ui-store element view of kind `machine`)
 * @param {{parseOptions?: object}} [options]
 * @returns {{machines: Map<string, Machine>, diagnostics: Diagnostic[]}}
 */
export function parseMachines(source, options = {}) {
  const diagnostics = [];
  const machines = new Map();
  const visit = (node) => {
    if (node?.kind === 'machine') {
      const machine = readMachine(node, diagnostics);
      machines.set(machine.id ?? `_${machines.size}`, machine);
    }
    (node?.children ?? []).forEach(visit);
  };
  nodesOf(source, diagnostics, options).forEach(visit);
  return { machines, diagnostics };
}

/**
 * Read the first `machine` element of a source.
 * @param {string | object} source  LiNo text, a ui-core document or node
 * @param {{parseOptions?: object}} [options]
 * @returns {{machine: Machine|null, diagnostics: Diagnostic[]}}
 */
export function parseMachine(source, options = {}) {
  const { machines, diagnostics } = parseMachines(source, options);
  const [machine = null] = machines.values();
  if (machine === null) {
    diagnostics.push(
      diagnostic('invalid-machine', 'error', {
        reason: 'no element of kind machine',
      })
    );
  }
  return { machine, diagnostics };
}

/** Thrown by `createMachine` for a machine with errors. */
export class MachineError extends Error {
  /** @param {Diagnostic[]} diagnostics */
  constructor(diagnostics) {
    super(diagnostics.map((d) => d.message).join('; '));
    this.name = 'MachineError';
    this.diagnostics = diagnostics;
  }
}

/**
 * A machine from LiNo text or a node; throws a `MachineError` listing the
 * error diagnostics when there are any (warnings are ignored).
 * @param {string | object} source
 * @param {{parseOptions?: object}} [options]
 * @returns {Machine}
 */
export function createMachine(source, options) {
  const { machine, diagnostics } = parseMachine(source, options);
  const errors = diagnostics.filter((d) => d.severity === 'error');
  if (errors.length > 0) {
    throw new MachineError(errors);
  }
  return machine;
}
