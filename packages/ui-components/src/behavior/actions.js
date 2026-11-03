/**
 * The actions registry: action names map to host functions. A handler such
 * as `(on press (navigate home))` or a machine step `(do focus-content)`
 * is looked up by name and dispatched with its arguments as data. An
 * unknown name is a diagnostic, never code: nothing is evaluated.
 *
 * The vocabulary actions (docs/spec/vocabulary.lino) have default
 * implementations that validate their arguments and call the `host`
 * function of the same name, so a renderer decides what "navigate" means:
 *
 * | Action                    | Default                                       |
 * | ------------------------- | --------------------------------------------- |
 * | `(navigate target)`       | rejects `javascript:`, `data:`, `vbscript:`; `host.navigate(target)` |
 * | `(emit event)`            | `host.emit(event)`                            |
 * | `(set target prop value)` | `host.set(target, prop, value)`               |
 * | `(toggle target prop)`    | `host.toggle(target, prop)`                   |
 * | `(focus target)`          | `meta.effects.focus(target)`, else `host.focus(target)` |
 */

import { diagnostic, isUnsafeUrl } from './diagnostics.js';

/**
 * @typedef {import('./diagnostics.js').diagnostic} DiagnosticFn
 * @typedef {ReturnType<DiagnosticFn>} Diagnostic
 *
 * @typedef {object} ActionMeta  what a handler learns besides its
 *   arguments; every field is optional
 * @property {string|null} [source]  the element (store ID) of the event
 * @property {string} [event]  the UI or machine event
 * @property {string} [state]  the machine state
 * @property {Readonly<Record<string, unknown>>} [context]  the machine
 *   context
 * @property {(patch: Record<string, unknown>) => void} [assign]  update
 *   the machine context
 * @property {Record<string, Function>} [effects]  host effects of the
 *   bound machine (`focus` from `bindMachine`)
 *
 * @typedef {(args: readonly unknown[], meta: ActionMeta) => unknown} ActionFn
 *
 * @typedef {object} DispatchResult
 * @property {boolean} ok
 * @property {unknown} [value]  what the handler returned
 * @property {Diagnostic} [diagnostic]  why nothing (or not all) ran
 *
 * @typedef {object} ActionRegistry
 * @property {(name: string, fn: ActionFn) => () => void} register  add or
 *   replace an action; returns a function that removes it again
 * @property {(name: unknown) => boolean} has
 * @property {() => string[]} names
 * @property {(name: unknown, args?: readonly unknown[],
 *   meta?: ActionMeta) => DispatchResult} dispatch
 *
 * @typedef {object} HostActions  what the default vocabulary actions call
 * @property {(target: string, meta: ActionMeta) => unknown} [navigate]
 * @property {(event: string, args: readonly unknown[], meta: ActionMeta) => unknown} [emit]
 * @property {(target: string, property: string, value: unknown, meta: ActionMeta) => unknown} [set]
 * @property {(target: string, property: string, meta: ActionMeta) => unknown} [toggle]
 * @property {(target: string, meta: ActionMeta) => unknown} [focus]
 */

/** A failed dispatch: the diagnostic is also reported. */
class ActionFailure extends Error {
  constructor(code, at) {
    super(code);
    this.code = code;
    this.at = at;
  }
}

/** Fail the current action with a diagnostic (for action handlers). */
export const fail = (code, at = {}) => {
  throw new ActionFailure(code, at);
};

const requireText = (value, reason) =>
  typeof value === 'string' && value !== ''
    ? value
    : fail('invalid-argument', { reason });

/** Call the host function `name`, or report that there is none. */
function callHost(host, name, args) {
  const fn = host[name];
  return typeof fn === 'function'
    ? fn(...args)
    : fail('unhandled-action', { action: name });
}

/** The default implementations of the vocabulary actions. */
function vocabularyActions(host) {
  return {
    navigate([target], meta) {
      requireText(target, 'navigate needs a target');
      if (isUnsafeUrl(target)) {
        fail('unsafe-url', { url: target });
      }
      return callHost(host, 'navigate', [target, meta]);
    },
    emit([event, ...args], meta) {
      requireText(event, 'emit needs an event name');
      return callHost(host, 'emit', [event, args, meta]);
    },
    set([target, property, value], meta) {
      requireText(target, 'set needs a target');
      requireText(property, 'set needs a property');
      return callHost(host, 'set', [target, property, value, meta]);
    },
    toggle([target, property], meta) {
      requireText(target, 'toggle needs a target');
      requireText(property, 'toggle needs a property');
      return callHost(host, 'toggle', [target, property, meta]);
    },
    focus([target], meta) {
      requireText(target, 'focus needs a target');
      const effect = meta.effects?.focus;
      return typeof effect === 'function'
        ? effect(target, meta)
        : callHost(host, 'focus', [target, meta]);
    },
  };
}

/** The names of the vocabulary actions, which have defaults. */
export const VOCABULARY_ACTIONS = Object.freeze([
  'navigate',
  'emit',
  'set',
  'toggle',
  'focus',
]);

/**
 * Create an actions registry.
 * @param {{onUnknown?: (d: Diagnostic) => void,
 *   onDiagnostic?: (d: Diagnostic) => void, host?: HostActions,
 *   defaults?: boolean}} [options]  `onUnknown` gets `unknown-action`
 *   diagnostics, `onDiagnostic` every diagnostic; `defaults: false`
 *   leaves out the vocabulary actions
 * @returns {ActionRegistry}
 */
export function createActionRegistry(options = {}) {
  /** @type {Map<string, ActionFn>} */
  const actions = new Map();
  if (options.defaults !== false) {
    for (const [name, fn] of Object.entries(
      vocabularyActions(options.host ?? {})
    )) {
      actions.set(name, fn);
    }
  }

  const report = (code, severity, at) => {
    const d = diagnostic(code, severity, at);
    if (code === 'unknown-action') {
      options.onUnknown?.(d);
    }
    options.onDiagnostic?.(d);
    return { ok: false, diagnostic: d };
  };

  return Object.freeze({
    register(name, fn) {
      if (typeof name !== 'string' || name === '') {
        throw new TypeError('register: the name must be a non-empty string');
      }
      if (typeof fn !== 'function') {
        throw new TypeError(`register(${name}): the action must be a function`);
      }
      actions.set(name, fn);
      return () => {
        if (actions.get(name) === fn) {
          actions.delete(name);
        }
      };
    },
    has: (name) => typeof name === 'string' && actions.has(name),
    names: () => [...actions.keys()],
    dispatch(name, args = [], meta = {}) {
      if (typeof name !== 'string' || !actions.has(name)) {
        return report('unknown-action', 'warning', { action: String(name) });
      }
      try {
        return {
          ok: true,
          value: actions.get(name)(Object.freeze([...args]), meta),
        };
      } catch (error) {
        if (error instanceof ActionFailure) {
          return report(error.code, 'error', { action: name, ...error.at });
        }
        return report('action-error', 'error', {
          action: name,
          error: String(error?.message ?? error),
        });
      }
    },
  });
}

/**
 * Dispatch the actions of a handler `(on EVENT ACTION...)` given as its
 * values (`['press', ['navigate', 'home']]`). An action that is not a
 * link, such as the string `'alert(1)'`, is looked up as a name too, so it
 * is reported as `unknown-action` and never run.
 * @param {ActionRegistry} registry
 * @param {readonly unknown[]} values  the values of the `on` property
 * @param {ActionMeta} [meta]
 * @returns {DispatchResult[]}
 */
export function dispatchHandler(registry, values, meta = {}) {
  const [event, ...actions] = values;
  return actions.map((action) =>
    Array.isArray(action)
      ? registry.dispatch(action[0], action.slice(1), { event, ...meta })
      : registry.dispatch(action, [], { event, ...meta })
  );
}

/**
 * Check the actions of a handler `(on EVENT ACTION...)` without running
 * any: every action whose name is not registered (a string such as
 * `'alert(1)'` included) is an `unknown-action` diagnostic.
 * @param {ActionRegistry} registry
 * @param {readonly unknown[]} values  the values of the `on` property
 * @param {Record<string, unknown>} [at]  where the handler is
 * @returns {Diagnostic[]}
 */
export function checkHandler(registry, values, at = {}) {
  const [, ...actions] = values;
  return actions
    .map((action) => (Array.isArray(action) ? action[0] : action))
    .filter((name) => !registry.has(name))
    .map((name) =>
      diagnostic('unknown-action', 'warning', { ...at, action: String(name) })
    );
}
