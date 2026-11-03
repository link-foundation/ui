/**
 * The rendered tree of a store, shared by `render` (a live DOM) and
 * `renderToHTML` (a static document): one custom element per store
 * element, its store ID in `data-link-id`, kept in a Map (ID → node) and a
 * WeakMap (node → ID).
 *
 * Every store element gets a node, so `idFor(nodeFor(id)) === id` holds
 * for all of them; the children of a kind without a children slot (a text
 * with children) stay detached.
 */

import { GENERATED_ID_PREFIX } from '@link-foundation/ui-store';
import { diagnostic } from './diagnostics.js';
import { bindHandlers, handlersOf } from './events.js';
import { UNKNOWN_KIND } from './kinds/basic.js';
import { ensureTag, getKind } from './kinds.js';
import { atom, elementOf, propNames, withProperties } from './model.js';

/**
 * @typedef {import('./model.js').Element} Element
 *
 * @typedef {object} TreeOptions
 * @property {Document} document
 * @property {Node} container  the parent of the root elements
 * @property {Record<string, any>} options  the render options
 * @property {boolean} interactive  bind `(on ...)` handlers
 * @property {(d: object) => void} report
 */

/** Mirror the properties a kind lists in `attributes` (for CSS). */
function mirrorAttributes(node, spec, el, changed) {
  for (const [name, type] of Object.entries(spec.attributes ?? {})) {
    if (!changed.includes(name)) {
      continue;
    }
    const value = atom(el, name);
    if (type === 'boolean') {
      node.toggleAttribute(name, value === 'true');
    } else if (value === undefined) {
      node.removeAttribute(name);
    } else {
      node.setAttribute(name, value);
    }
  }
}

/** Run a kind's update; a failing renderer is reported, not thrown. */
function runUpdate(node, el, spec, changed, ctx) {
  try {
    spec.update?.(node, el, changed, ctx);
  } catch (error) {
    ctx.diagnostic('kind-error', 'error', { error: String(error?.message) });
  }
  mirrorAttributes(node, spec, el, changed);
}

/** Create the node of an element (unknown kind or kind error → `ui-unknown`). */
function createNode(win, el, kinds, ctx) {
  let spec = getKind(el.kind, kinds);
  if (spec === undefined) {
    ctx.diagnostic('unknown-kind', 'warning');
    spec = UNKNOWN_KIND;
  }
  try {
    ensureTag(win, spec.tag);
    return { spec, node: spec.create(el, ctx) };
  } catch (error) {
    ctx.diagnostic('kind-error', 'error', { error: String(error?.message) });
    ensureTag(win, UNKNOWN_KIND.tag);
    return { spec: UNKNOWN_KIND, node: UNKNOWN_KIND.create(el, ctx) };
  }
}

/** Where the children of a rendered node go; `null` when it takes none. */
function slotOf(node, spec) {
  if (spec.childrenSlot === null) {
    return null;
  }
  return spec.childrenSlot?.(node) ?? node;
}

/**
 * Put a node at a store index among the rendered nodes (`isRendered`) of
 * the slot; with no slot the node is detached.
 */
function place(node, slot, index, isRendered) {
  if (slot === null) {
    node.remove();
    return;
  }
  const rendered = [...slot.children].filter(
    (child) => child !== node && isRendered(child)
  );
  slot.insertBefore(node, rendered[index] ?? null);
}

/** The store ID of a node or of its closest rendered ancestor. */
function closestId(ids, node) {
  for (let n = node; n !== null && n !== undefined; n = n.parentNode) {
    const id = ids.get(n);
    if (id !== undefined) {
      return id;
    }
  }
  return null;
}

/** Render every element of the store, roots first, in document order. */
function mountStore(store, insert) {
  const visit = (id, parentId, index) => {
    insert(store.get(id), parentId, index);
    store.children(id).forEach((child, i) => visit(child, id, i));
  };
  store.roots().forEach((id, i) => visit(id, null, i));
}

/**
 * The context a kind gets: the document, the render options, a diagnostic
 * reporter, and the child elements in the mounted store.
 */
const kindContext = (document, options, report, mounted) => (id, kind) => ({
  document,
  options,
  diagnostic(code, severity, at = {}) {
    report(diagnostic(code, severity, { element: id, kind, ...at }));
  },
  children: () => {
    const { store } = mounted;
    return store === null
      ? []
      : store.children(id).map((child) => elementOf(store.get(child)));
  },
});

/**
 * @param {TreeOptions} tree
 */
export function createTree({
  document,
  container,
  options,
  interactive,
  report,
}) {
  const win = document.defaultView;
  /** @type {Map<string, HTMLElement>} */
  const nodes = new Map();
  /** @type {WeakMap<Node, string>} */
  const ids = new WeakMap();
  /** @type {Map<string, {el: Element, spec: object, unbind?: () => void}>} */
  const state = new Map();
  /** The store of the last `mount` (for `ctx.children`). */
  const mounted = { store: null };
  const contextOf = kindContext(document, options, report, mounted);

  const idFor = (node) => closestId(ids, node);

  function bind(id) {
    const entry = state.get(id);
    entry.unbind?.();
    entry.unbind = undefined;
    const ctx = contextOf(id, entry.el.kind);
    const handlers = handlersOf(entry.el, ctx.diagnostic, options.isAction);
    if (!interactive || handlers.length === 0) {
      return;
    }
    const node = nodes.get(id);
    const target = entry.spec.eventTarget?.(node) ?? node;
    entry.unbind = bindHandlers(node, target, handlers, {
      idFor,
      onAction: options.onAction,
      diagnostic: ctx.diagnostic,
    });
  }

  const refresh = (id, changed) => {
    const entry = state.get(id);
    runUpdate(
      nodes.get(id),
      entry.el,
      entry.spec,
      changed,
      contextOf(id, entry.el.kind)
    );
  };

  const slotFor = (parentId) => {
    if (parentId === null) {
      return container;
    }
    const node = nodes.get(parentId);
    return node === undefined ? null : slotOf(node, state.get(parentId).spec);
  };

  const put = (node, parentId, index) =>
    place(node, slotFor(parentId), index, (child) => ids.has(child));

  /**
   * Render one element (not its children) at `index` of `parentId`.
   * @param {object} view  a store element view
   */
  function insert(view, parentId, index) {
    const el = elementOf(view);
    const { spec, node } = createNode(
      win,
      el,
      options.kinds,
      contextOf(el.id, el.kind)
    );
    node.setAttribute('data-link-id', el.id);
    nodes.set(el.id, node);
    ids.set(node, el.id);
    state.set(el.id, { el, spec });
    refresh(el.id, propNames(el));
    bind(el.id);
    put(node, parentId, index);
    return node;
  }

  /** Apply new properties; `changed` are the names that changed. */
  function update(id, properties, changed) {
    const entry = state.get(id);
    if (entry === undefined) {
      return false;
    }
    entry.el = withProperties(entry.el, properties);
    refresh(id, changed);
    if (changed.includes('on')) {
      bind(id);
    }
    return true;
  }

  function move(id, parentId, index) {
    const node = nodes.get(id);
    if (node === undefined) {
      return false;
    }
    put(node, parentId, index);
    return true;
  }

  /** Destroy one element's node (its children are removed before it). */
  function remove(id) {
    const node = nodes.get(id);
    if (node === undefined) {
      return false;
    }
    const entry = state.get(id);
    entry.unbind?.();
    const ctx = contextOf(id, entry.el.kind);
    try {
      entry.spec.destroy?.(node, ctx);
    } catch (error) {
      ctx.diagnostic('kind-error', 'error', { error: String(error?.message) });
    }
    node.remove();
    nodes.delete(id);
    ids.delete(node);
    state.delete(id);
    return true;
  }

  function rename(from, to) {
    const node = nodes.get(from);
    if (node === undefined || nodes.has(to)) {
      return false;
    }
    const entry = state.get(from);
    entry.el = Object.freeze({
      ...entry.el,
      id: to,
      // `rename(id, null)` makes the element anonymous under a generated ID.
      name: to.startsWith(GENERATED_ID_PREFIX) ? null : to,
    });
    nodes.delete(from);
    state.delete(from);
    nodes.set(to, node);
    state.set(to, entry);
    ids.set(node, to);
    node.setAttribute('data-link-id', to);
    return true;
  }

  /** Destroy every node, children before parents. */
  function clear() {
    for (const id of [...nodes.keys()].reverse()) {
      remove(id);
    }
  }

  return {
    nodes,
    insert,
    update,
    move,
    remove,
    rename,
    mount(store) {
      mounted.store = store;
      mountStore(store, insert);
    },
    clear,
    nodeFor: (id) => nodes.get(id) ?? null,
    idFor,
    elementFor: (id) => state.get(id)?.el ?? null,
  };
}
