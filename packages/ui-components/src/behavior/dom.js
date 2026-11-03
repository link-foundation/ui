/**
 * `@link-foundation/ui-components/behavior/dom`: behaviour on top of the
 * ui-dom renderer. `mountBehavior(container, text, options)` mounts a
 * document like ui-dom `mountDocument` and
 *
 * - routes every `ui-action` (an `(on EVENT ACTION...)` handler) through
 *   the actions registry, so an action name only ever selects a registered
 *   function;
 * - starts a machine service for each element with
 *   `(machine NAME (PART ELEMENT-ID)...)` when the element is mounted, binds
 *   it to the element with `bindMachine`, and stops it when the element is
 *   removed or the document is destroyed.
 *
 * Machines come from `options.machines`, from `machine` elements of the
 * document, and from the reference machines (`toggle-machine`,
 * `disclosure-machine`).
 */

import { getKind, mountDocument, defineKind } from '@link-foundation/ui-dom';
import { bindMachine } from '../a11y/bind-machine.js';
import { checkHandler, createActionRegistry } from './actions.js';
import { diagnostic } from './diagnostics.js';
import { interpret } from './interpret.js';
import { REFERENCE_MACHINES } from './machines/index.js';
import { createMachine, parseMachines, toValue } from './parse-machine.js';

/** A `machine` element is a definition: it renders as a hidden node. */
defineKind('machine', {
  tag: 'ui-machine',
  childrenSlot: null,
  create(el, ctx) {
    const node = ctx.document.createElement('ui-machine');
    node.hidden = true;
    return node;
  },
});

/**
 * The rules behaviour needs on top of the ui-dom base CSS: a hidden part
 * is hidden even when its kind sets `display`.
 */
export const BEHAVIOR_CSS = `ui-machine { display: none; }
[data-part][hidden] { display: none !important; }
`;

/** Every element view of a store, depth first. */
function* viewsOf(store) {
  const stack = [...store.roots()].reverse();
  while (stack.length > 0) {
    const id = stack.pop();
    const view = store.get(id);
    if (view !== undefined) {
      yield view;
      stack.push(...[...store.children(id)].reverse());
    }
  }
}

/** The values of the last property `name` of a view, or `undefined`. */
const propOf = (view, name) =>
  view.properties.findLast((p) => p.name === name)?.values;

/** The single atom value of a property, or `undefined`. */
const atomOf = (view, name) => {
  const values = propOf(view, name);
  return values?.length === 1 && typeof values[0] === 'string'
    ? values[0]
    : undefined;
};

/** Machines of the `machines` option: machine objects or LiNo text. */
function machinesOption(machines, report) {
  const map = new Map();
  for (const [name, value] of Object.entries(machines ?? {})) {
    if (typeof value === 'string') {
      const read = parseMachines(value);
      read.diagnostics.forEach(report);
      const [machine] = read.machines.values();
      if (machine) {
        map.set(name, machine);
      }
    } else if (value && typeof value === 'object') {
      map.set(name, value);
    }
  }
  return map;
}

/**
 * The machine reference of an element: `(machine NAME (PART ID)...)`.
 * @returns {{name: string, parts: Record<string, string>, key: string}|null}
 */
function machineRef(view) {
  const values = propOf(view, 'machine');
  if (!values || typeof values[0] !== 'string') {
    return null;
  }
  const parts = {};
  for (const link of values.slice(1)) {
    if (
      Array.isArray(link) &&
      typeof link[0] === 'string' &&
      typeof link[1] === 'string'
    ) {
      parts[link[0]] = link[1];
    }
  }
  return { name: values[0], parts, key: JSON.stringify(values) };
}

/**
 * Host functions for the vocabulary actions, on the store and the nodes.
 * `navigate` has no default: the host decides what navigation means.
 */
function storeHost(state, container) {
  const requireElement = (target) => {
    if (!state.store.has(target)) {
      throw new Error(`no element ${JSON.stringify(target)}`);
    }
  };
  return {
    set(target, property, value) {
      requireElement(target);
      state.store.setProp(target, property, [String(value)]);
    },
    toggle(target, property) {
      requireElement(target);
      const current = atomOf(state.store.get(target), property);
      state.store.setProp(target, property, [String(current !== 'true')]);
    },
    focus(target) {
      requireElement(target);
      const node = state.partNode(target);
      node?.focus();
      return node !== null;
    },
    emit(event, args, meta) {
      const win = container.ownerDocument.defaultView;
      container.dispatchEvent(
        new win.CustomEvent('ui-emit', {
          bubbles: true,
          composed: true,
          detail: Object.freeze({ event, args, source: meta.source ?? null }),
        })
      );
    },
  };
}

/**
 * @typedef {object} BehaviorOptions
 * @property {import('./actions.js').ActionRegistry |
 *   Record<string, import('./actions.js').ActionFn>} [actions]  a
 *   registry, or actions to add to the default one
 * @property {import('./actions.js').HostActions} [host]  host functions
 *   for the vocabulary actions (`navigate` has no default)
 * @property {Record<string, import('./parse-machine.js').Machine | string>}
 *   [machines]  machines by name, before the document and the reference
 *   machines
 * @property {boolean} [referenceMachines]  `false` leaves out the
 *   reference machines
 * @property {Record<string, import('./interpret.js').Guard>} [guards]
 * @property {import('./interpret.js').Clock} [clock]
 *
 * @typedef {object} BehaviorHandle
 * @property {import('@link-foundation/ui-store').Store} store
 * @property {ReturnType<typeof import('@link-foundation/ui-dom').render>} handle
 * @property {import('./actions.js').ActionRegistry} registry
 * @property {object[]} diagnostics
 * @property {(id: string) => import('./interpret.js').Service | null}
 *   serviceFor  the running service of an element
 * @property {() => void} destroy  stop every service and remove the
 *   document
 */

/** The registry of the options: a registry, or the default one plus actions. */
function registryOf(options, host, report) {
  if (options.actions && typeof options.actions.dispatch === 'function') {
    return options.actions;
  }
  const registry = createActionRegistry({
    host: { ...host, ...options.host },
    onDiagnostic: report,
  });
  for (const [name, fn] of Object.entries(options.actions ?? {})) {
    registry.register(name, fn);
  }
  return registry;
}

/** The machines of `machine` elements in the store, by name and store ID. */
function documentMachines(store, reportOnce) {
  const map = new Map();
  for (const view of viewsOf(store)) {
    if (view.kind === 'machine') {
      const read = parseMachines({ ...view, children: [] });
      read.diagnostics.forEach((d) =>
        reportOnce(`${view.id}:${d.code}:${JSON.stringify(d.at)}`, d)
      );
      const [machine] = read.machines.values();
      map.set(view.name ?? view.id, machine);
      map.set(view.id, machine);
    }
  }
  return map;
}

/**
 * Find machines by name: the `machines` option, then the document, then
 * the reference machines (read once).
 */
function machineFinder(options, report) {
  const known = machinesOption(options.machines, report);
  return (name, local) => {
    if (known.has(name)) {
      return known.get(name);
    }
    if (local.has(name)) {
      return local.get(name);
    }
    if (
      options.referenceMachines !== false &&
      Object.hasOwn(REFERENCE_MACHINES, name)
    ) {
      known.set(name, createMachine(REFERENCE_MACHINES[name]));
      return known.get(name);
    }
    return null;
  };
}

/** The initial context: machine context fields the element sets. */
function contextOf(view, machine) {
  const context = {};
  for (const name of Object.keys(machine.context)) {
    const value = atomOf(view, name);
    if (value !== undefined) {
      context[name] = toValue(value);
    }
  }
  return context;
}

/**
 * Report handler actions that are text, not links, such as
 * `(on press 'alert(1)')`, as `unknown-action`: ui-dom drops them as
 * `invalid-handler`, and none ever runs. (ui-dom itself reports links
 * whose name `registry.has` does not know.)
 */
function checkHandlers(store, registry, reportOnce) {
  for (const view of viewsOf(store)) {
    for (const property of view.properties) {
      if (property.name === 'on') {
        const at = { element: view.name ?? view.id };
        const [event, ...actions] = property.values;
        const texts = actions.filter((action) => !Array.isArray(action));
        checkHandler(registry, [event, ...texts], at).forEach((d) =>
          reportOnce(`${view.id}:${JSON.stringify(d.at)}`, d)
        );
      }
    }
  }
}

/**
 * The services of the machine elements of a store: `sync()` starts,
 * updates and stops them to match the store.
 */
function createServices(state, options, registry, report, reportOnce) {
  const findMachine = machineFinder(options, report);
  /** @type {Map<string, {key: string, machine: object, service: object, unbind: () => void}>} */
  const services = new Map();

  const stop = (id) => {
    const entry = services.get(id);
    if (entry) {
      entry.unbind();
      entry.service.stop();
      services.delete(id);
    }
  };

  const start = (view, ref, machine) => {
    const service = interpret(machine, {
      actions: registry,
      guards: options.guards,
      clock: options.clock,
      context: contextOf(view, machine),
      onDiagnostic: report,
    });
    const element = state.partNode(view.id);
    const parts = (part) =>
      Object.hasOwn(ref.parts, part)
        ? state.partNode(ref.parts[part])
        : element;
    const unbind = bindMachine(element, service, parts, {
      onDiagnostic: report,
    });
    services.set(view.id, { key: ref.key, machine, service, unbind });
  };

  /** Pass changed element properties that the context has to the service. */
  const update = (view, machine) => {
    const { service } = services.get(view.id);
    const context = contextOf(view, machine);
    if (Object.entries(context).some(([k, v]) => service.context[k] !== v)) {
      service.assign(context);
    }
  };

  const syncOne = (view, ref, local) => {
    const machine = findMachine(ref.name, local);
    const entry = services.get(view.id);
    if (entry && (entry.key !== ref.key || entry.machine !== machine)) {
      stop(view.id);
    }
    if (machine === null) {
      reportOnce(
        `${view.id}:unknown-machine:${ref.name}`,
        diagnostic('unknown-machine', 'error', {
          element: view.name ?? view.id,
          machine: ref.name,
        })
      );
    } else if (services.has(view.id)) {
      update(view, machine);
    } else {
      start(view, ref, machine);
    }
  };

  return {
    get: (id) => services.get(id)?.service ?? null,
    sync() {
      const seen = new Set();
      let local = null;
      for (const view of viewsOf(state.store)) {
        const ref = machineRef(view);
        if (ref !== null) {
          seen.add(view.id);
          local ??= documentMachines(state.store, reportOnce);
          syncOne(view, ref, local);
        }
      }
      [...services.keys()].filter((id) => !seen.has(id)).forEach(stop);
    },
    stopAll: () => [...services.keys()].forEach(stop),
  };
}

/**
 * Mount a document with behaviour.
 * @param {Element} container
 * @param {string} text
 * @param {BehaviorOptions & Parameters<typeof mountDocument>[2]} [options]
 *   every ui-dom `mountDocument` option, plus the behaviour options
 * @returns {BehaviorHandle}
 */
export function mountBehavior(container, text, options = {}) {
  const diagnostics = [];
  const report = (d) => {
    diagnostics.push(d);
    options.onDiagnostic?.(d);
  };
  const reported = new Set();
  const reportOnce = (key, d) => {
    if (!reported.has(key)) {
      reported.add(key);
      report(d);
    }
  };
  const state = { store: null, handle: null };
  /** The node a part binds to: the kind's event target (the `<button>`). */
  state.partNode = (id) => {
    const node = state.handle?.nodeFor(id) ?? null;
    const view = state.store?.get(id);
    if (node === null || view === undefined) {
      return null;
    }
    return getKind(view.kind, options.kinds)?.eventTarget?.(node) ?? node;
  };
  const registry = registryOf(options, storeHost(state, container), report);
  const services = createServices(state, options, registry, report, reportOnce);

  const mounted = mountDocument(container, text, {
    ...options,
    css: `${BEHAVIOR_CSS}${options.css ?? ''}`,
    onDiagnostic: report,
    isAction: (name) => registry.has(name),
    onAction(detail, event) {
      const [name, ...args] = detail.action;
      registry.dispatch(name, args, {
        source: detail.source,
        event: detail.event,
      });
      options.onAction?.(detail, event);
    },
    onPatch(events) {
      services.sync();
      checkHandlers(state.store, registry, reportOnce);
      options.onPatch?.(events);
    },
  });
  state.store = mounted.store;
  state.handle = mounted.handle;
  checkHandlers(state.store, registry, reportOnce);
  services.sync();

  return {
    store: mounted.store,
    handle: mounted.handle,
    registry,
    diagnostics,
    serviceFor: services.get,
    destroy() {
      services.stopAll();
      mounted.handle.destroy();
    },
  };
}
