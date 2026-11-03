/**
 * Helpers shared by the layout kinds: reading property values, unique DOM
 * ids, the rendered children of a node, one controller per live node, and
 * typed CSS values through ui-style.
 *
 * The kinds also render into the static document of ui-dom
 * `renderToHTML`, which has no window: there they only write attributes and
 * styles, and no controller is made (`isLive`).
 */

import {
  PROPERTIES,
  declarationCss,
  typeDeclaration,
} from '@link-foundation/ui-style';
import { cssVariable } from '@link-foundation/ui-tokens';
import { createLayerManager } from './layer-manager.js';

/** Every value of a property, nested lists flattened, as strings. */
export function valuesOf(el, name) {
  const raw = el.props.get(name);
  if (raw === undefined) {
    return [];
  }
  return raw.flat(Infinity).filter((v) => typeof v === 'string');
}

/** The single text value of a property; `undefined` when it has none. */
export function atomOf(el, name) {
  const raw = el.props.get(name);
  return raw?.length === 1 && typeof raw[0] === 'string' ? raw[0] : undefined;
}

/** A finite number of a property, else `fallback`. */
export function numberOf(el, name, fallback) {
  const value = Number(atomOf(el, name));
  return atomOf(el, name) !== undefined && Number.isFinite(value)
    ? value
    : fallback;
}

/** Whether a boolean property is `true` (`fallback` when it is missing). */
export function flagOf(el, name, fallback = false) {
  const value = atomOf(el, name);
  return value === undefined ? fallback : value === 'true';
}

/**
 * One limit of a split per pane: `(min 20)` is one value for every pane,
 * `(min 20 30)` one value per pane.
 */
export function listOf(el, name, parse) {
  const items = valuesOf(el, name).map(parse);
  if (items.length === 0) {
    return undefined;
  }
  return items.length === 1 ? items[0] : items;
}

let counter = 0;

/** A document-unique id for helper nodes (`ui-layout-N`). */
export const uid = (prefix = 'ui-layout') => {
  counter += 1;
  return `${prefix}-${counter}`;
};

/** The id of a node, given one when it has none. */
export function idOf(node, prefix) {
  if (!node.id) {
    node.id = uid(prefix);
  }
  return node.id;
}

/** Whether the kind renders into a live document (with a window). */
export const isLive = (ctx) =>
  ctx.document.defaultView !== null &&
  ctx.document.defaultView !== undefined &&
  typeof ctx.document.defaultView.MutationObserver === 'function';

/** The rendered children of a node: the elements of the store. */
export const renderedChildren = (node) =>
  [...node.children].filter((child) => child.hasAttribute('data-link-id'));

/** The store id of a rendered node. */
export const linkId = (node) => node.getAttribute('data-link-id');

/** The text that names a rendered node (its title, label or id). */
export const titleOf = (node) =>
  node.getAttribute('data-title') ??
  node.getAttribute('aria-label') ??
  linkId(node) ??
  '';

const controllers = new WeakMap();

/**
 * The controller of a live node: `make(node)` builds it on the first call,
 * and `dropController` (the kind's `destroy`) disconnects it.
 */
export function controllerOf(node, make) {
  let controller = controllers.get(node);
  if (controller === undefined) {
    controller = make(node);
    controllers.set(node, controller);
  }
  return controller;
}

/** The controller of a node, when it has one. */
export const findController = (node) => controllers.get(node);

/** Disconnect and forget the controller of a node. */
export function dropController(node) {
  controllers.get(node)?.disconnect?.();
  controllers.delete(node);
}

/**
 * Call `refresh` once per task after the rendered children of `node`
 * change (added, removed, moved, or one of `attributes` of a child set).
 * The returned `observer.takeRecords()` drops the records of the kind's
 * own changes.
 */
export function watchChildren(node, refresh, attributes = []) {
  const win = node.ownerDocument.defaultView;
  let pending = false;
  const observer = new win.MutationObserver((records) => {
    const relevant = records.some(
      (r) =>
        r.type !== 'attributes' ||
        (r.target.parentNode === node && r.target.hasAttribute('data-link-id'))
    );
    if (!relevant || pending) {
      return;
    }
    pending = true;
    win.queueMicrotask(() => {
      pending = false;
      refresh();
      observer.takeRecords();
    });
  });
  const init = { childList: true };
  if (attributes.length > 0) {
    Object.assign(init, {
      attributes: true,
      subtree: true,
      attributeFilter: attributes,
    });
  }
  observer.observe(node, init);
  return observer;
}

/** The CSS context of ui-style `declarationCss`: tokens → `var(--…)`. */
function cssContext(prefix = '') {
  const refToVar = (ref, fallback) =>
    `var(${cssVariable(ref.path, prefix)}${fallback === undefined ? '' : `, ${fallback}`})`;
  return {
    refToVar,
    variable: (path) => refToVar({ type: 'token-ref', path }),
  };
}

/**
 * Set a typed style property (`gap`, `padding`) of the node from the
 * element, through ui-style: an invalid value is reported and left out.
 */
export function setTypedStyle(node, el, name, ctx) {
  const css = PROPERTIES[name].css;
  const raws = el.props.get(name);
  if (raws === undefined) {
    node.style.removeProperty(css);
    return;
  }
  const decl = typeDeclaration(name, [...raws], {}, []);
  if (decl === null) {
    node.style.removeProperty(css);
    ctx.diagnostic('invalid-value', 'error', { property: name });
    return;
  }
  node.style.setProperty(
    css,
    declarationCss(decl, cssContext(ctx.options.prefix))
  );
}

/** Set or remove an attribute. */
export function setAttr(node, name, value) {
  if (value === undefined || value === null || value === false) {
    node.removeAttribute(name);
  } else {
    node.setAttribute(name, value === true ? '' : String(value));
  }
}

/** The storage of the render (`options.layout.storage`), or `null`. */
export function storageOf(ctx) {
  const storage = ctx.options?.layout?.storage;
  return typeof storage?.getItem === 'function' &&
    typeof storage?.setItem === 'function'
    ? storage
    : null;
}

/** Read a stored value; a failing storage reads as nothing. */
export function readStored(storage, key) {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** Write a stored value; a failing (full, denied) storage is ignored. */
export function writeStored(storage, key, value) {
  try {
    storage?.setItem(key, value);
  } catch {
    // Persistence is best effort.
  }
}

const defaultLayers = new WeakMap();

/**
 * The layer manager of the render (`options.layout.layers`), else one per
 * document, shared by its windows and docks.
 */
export function layersOf(ctx) {
  const given = ctx.options?.layout?.layers;
  if (given !== undefined) {
    return given;
  }
  let layers = defaultLayers.get(ctx.document);
  if (layers === undefined) {
    layers = createLayerManager({ base: 10 });
    defaultLayers.set(ctx.document, layers);
  }
  return layers;
}

/** Send a bubbling `CustomEvent` from a node. */
export function emit(node, type, detail) {
  const win = node.ownerDocument.defaultView;
  node.dispatchEvent(
    new win.CustomEvent(type, { bubbles: true, composed: true, detail })
  );
}

/** Make an element with attributes and optional text. */
export function make(document, tag, attributes = {}, text) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    setAttr(node, name, value);
  }
  if (text !== undefined) {
    node.appendChild(document.createTextNode(text));
  }
  return node;
}

/** Move a list of nodes so they appear in this order in `parent`. */
export function arrange(parent, nodes, before = null) {
  let ref = before;
  for (let i = nodes.length - 1; i >= 0; i -= 1) {
    if (nodes[i].parentNode !== parent || nodes[i].nextSibling !== ref) {
      parent.insertBefore(nodes[i], ref);
    }
    ref = nodes[i];
  }
}

/** Whether the user asked for reduced motion. */
export const reducedMotion = (win) =>
  win?.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/**
 * A `label` property names the node as a group (`role="group"` and
 * `aria-label`); without one the node has no role.
 */
export function labelGroup(node, el) {
  const label = atomOf(el, 'label');
  setAttr(node, 'role', label === undefined ? undefined : 'group');
  setAttr(node, 'aria-label', label);
}
