/**
 * The data of the inspector, without a DOM: the outline of the document,
 * the rows of the property grid and the checks of an edit. Every function
 * here is pure apart from the ones that write the configuration
 * (`applyEdit`, `resetProperty`, `saveSession`, `discardSession`), and those
 * only call ui-config.
 */

import {
  defaultVocabulary,
  formatLinks,
  valueMatches,
  values as uiValues,
} from '@link-foundation/ui-core';

/** The layers below `user`: dev mode reads them and never writes them. */
export const READ_ONLY_LAYERS = Object.freeze(['defaults', 'theme', 'site']);

/** The layers whose values count as a change made in dev mode. */
const CHANGED_LAYERS = new Set(['user', 'session']);

/** Properties a page never edits in the grid (multi-valued or opaque). */
const HIDDEN_TYPES = new Set(['any', 'action']);

/** An error of an edit dev mode refuses. */
export class DevModeError extends Error {
  /**
   * @param {string} code  `read-only-layer`, `locked-element`, `bad-value`,
   *   `not-editable` or `unknown-element`
   * @param {string} message
   */
  constructor(code, message) {
    super(message);
    this.name = 'DevModeError';
    this.code = code;
  }
}

const fail = (code, message) => {
  throw new DevModeError(code, message);
};

/**
 * @typedef {object} OutlineNode
 * @property {string} id
 * @property {string} type  the kind of the element
 * @property {OutlineNode[]} children
 */

/**
 * The outline of a document: `{ id, type, children }` for every element.
 * `tree` is a ui-store store (`roots()`, `get(id)`, `children(id)`) or a
 * ui-core document (`{ roots }` of nodes with `children`).
 * @param {object} tree
 * @returns {OutlineNode[]}
 */
export function buildOutline(tree) {
  if (typeof tree?.roots === 'function') {
    const visit = (id) => ({
      id,
      type: tree.get(id)?.kind ?? '',
      children: tree.children(id).map(visit),
    });
    return tree.roots().map(visit);
  }
  const visit = (node) => ({
    id: node.id,
    type: node.kind ?? '',
    children: (node.children ?? []).map(visit),
  });
  return (tree?.roots ?? []).map(visit);
}

/**
 * The outline nodes in document order, each with its `level` (1 for a root)
 * and the id of its parent.
 * @param {OutlineNode[]} outline
 * @returns {{ node: OutlineNode, level: number, parent: string|null }[]}
 */
export function flattenOutline(outline) {
  const out = [];
  const visit = (node, level, parent) => {
    out.push({ node, level, parent });
    node.children.forEach((child) => visit(child, level + 1, node.id));
  };
  outline.forEach((node) => visit(node, 1, null));
  return out;
}

/**
 * Whether an element is locked by the policy: it, or one of its ancestors,
 * is in `(locked-elements …)`.
 * @param {{ lockedElements: ReadonlySet<string> }} policy
 * @param {string} id
 * @param {(id: string) => string|null|undefined} [parentOf]
 */
export function isLocked(policy, id, parentOf) {
  const seen = new Set();
  for (let at = id; at && !seen.has(at); at = parentOf?.(at) ?? null) {
    if (policy.lockedElements.has(at)) {
      return true;
    }
    seen.add(at);
  }
  return false;
}

/** The highest layer the policy lets dev mode write, or `null`. */
export const topWritableLayer = (policy) => policy.writeLayers.at(-1) ?? null;

/** Whether the values are one token reference `(token path)`. */
export const tokenPath = (values) =>
  Array.isArray(values) &&
  values.length === 1 &&
  Array.isArray(values[0]) &&
  values[0].length === 2 &&
  values[0][0] === 'token' &&
  typeof values[0][1] === 'string'
    ? values[0][1]
    : null;

/** The editor of each named property type. */
const EDITORS = Object.freeze({
  string: { editor: 'string' },
  'element-ref': { editor: 'string' },
  'element-ref-or-url': { editor: 'string' },
  url: { editor: 'string' },
  number: { editor: 'number' },
  boolean: { editor: 'boolean' },
  color: { editor: 'color' },
  dimension: { editor: 'dimension', units: uiValues.DIMENSION_UNITS },
  duration: { editor: 'dimension', units: uiValues.DURATION_UNITS },
});

/**
 * The editor of a property type: `string`, `number`, `dimension` (a number
 * with a unit), `color`, `enum`, `boolean`, `token` or `readonly`.
 * @param {string|readonly string[]|undefined} type
 * @param {readonly unknown[]|undefined} values  the current values
 * @returns {{ editor: string, options?: readonly string[], units?: readonly string[] }}
 */
export function editorFor(type, values) {
  if (tokenPath(values) !== null) {
    return { editor: 'token' };
  }
  if (Array.isArray(type) && type[0] === 'enum') {
    const options = type.slice(1);
    return options.length === 2 &&
      options.includes('true') &&
      options.includes('false')
      ? { editor: 'boolean' }
      : { editor: 'enum', options };
  }
  return typeof type === 'string' && Object.hasOwn(EDITORS, type)
    ? { ...EDITORS[type] }
    : { editor: 'readonly' };
}

/**
 * Raw values as Links Notation text, the way they are written after a
 * property name (`'Hello, links'`, `(token space.medium)`). The text is
 * edited in a one-line field, so it is the inline form of the values. It is
 * written by ui-core `formatLinks`, so all quoting is done by
 * `links-notation`.
 * @param {readonly unknown[]|undefined} values
 */
export function formatValues(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return '';
  }
  return formatLinks([/** @type {any} */ (values)], { style: 'inline' })
    .trim()
    .slice(1, -1);
}

/** The vocabulary entry of a kind, or an empty one. */
function kindInfo(vocabulary, kind) {
  return (
    vocabulary.kinds.get(kind) ?? {
      positional: [],
      properties: new Map(),
      children: 'any',
    }
  );
}

/**
 * The row of the positional values of an element: they stand for the
 * first positional property (`(greeting: text 'Hello')` is the `value` of
 * the text). `null` without positional values.
 */
function positionalTarget(element, info) {
  if ((element.positional ?? []).length === 0) {
    return null;
  }
  const first = info.positional[0];
  return {
    label: first ?? element.kind,
    type: info.properties.get(first)?.type ?? 'string',
  };
}

/**
 * The properties an element shows in the grid, in order: its positional
 * values (named by its kind, as ui-config addresses them), then the
 * single-valued properties of its kind, then any other property it has.
 */
function rowTargets(element, info, keyedProps) {
  const targets = [];
  const seen = new Set();
  const add = (name, key, type, label = key ? `${name} ${key}` : name) => {
    const k = `${name}\u0000${key ?? ''}`;
    if (!seen.has(k)) {
      seen.add(k);
      targets.push({ name, key, type, label });
    }
  };
  const first = positionalTarget(element, info);
  if (first) {
    add(element.kind, null, first.type, first.label);
  }
  for (const [name, prop] of info.properties) {
    if (name !== first?.label && !prop.multi && !HIDDEN_TYPES.has(prop.type)) {
      add(name, null, prop.type);
    }
  }
  for (const { name, values } of element.properties ?? []) {
    const keyed = keyedProps.includes(name) && typeof values[0] === 'string';
    add(name, keyed ? values[0] : null, info.properties.get(name)?.type);
  }
  return targets;
}

/**
 * @typedef {object} PropertyRow
 * @property {string} name  the property name (the kind for positional values)
 * @property {string|null} key  the key of a keyed property (`token`, `state`)
 * @property {string} label  the name shown in the grid (`value` for the
 *   positional values of a text)
 * @property {string|readonly string[]|undefined} type  the vocabulary type
 * @property {string} editor  see {@link editorFor}
 * @property {readonly string[]} [options]  the values of an `enum` editor
 * @property {readonly string[]} [units]  the units of a `dimension` editor
 * @property {readonly unknown[]|undefined} value  the resolved raw values
 * @property {string} text  the resolved values as Links Notation
 * @property {string} layer  the layer the value comes from (`defaults` when
 *   no layer sets it)
 * @property {boolean} changed  true for a value of the `user` or `session` layer
 * @property {boolean} locked  the policy locks the element
 * @property {boolean} writable  the row can be edited and reset
 */

/**
 * The rows of the property grid of one element.
 * @param {{ id: string, kind: string, positional?: readonly unknown[],
 *   properties?: readonly { name: string, values: readonly unknown[] }[] }} element
 *   a ui-core node or a ui-store view
 * @param {object} config  a ui-config configuration
 * @param {{ policy?: { writeLayers: readonly string[],
 *   lockedElements: ReadonlySet<string> },
 *   vocabulary?: object, parentOf?: (id: string) => string|null }} [options]
 * @returns {PropertyRow[]}
 */
export function propertyRows(element, config, options = {}) {
  const vocabulary = options.vocabulary ?? defaultVocabulary();
  const policy = options.policy;
  const info = kindInfo(vocabulary, element.kind);
  const locked = policy
    ? isLocked(policy, element.id, options.parentOf)
    : false;
  const canWrite = !locked && (policy ? policy.writeLayers.length > 0 : true);
  const keyedProps = config.keyedProps ?? [];
  return rowTargets(element, info, keyedProps).map((target) => {
    const { name, key, type } = target;
    const resolved = config.resolve(element.id, name, key ?? undefined);
    const value = resolved?.value;
    const layer = resolved?.layer ?? 'defaults';
    const editor = editorFor(type, value);
    return Object.freeze({
      name,
      key,
      label: target.label,
      type,
      ...editor,
      value,
      text: formatValues(value),
      layer,
      changed: CHANGED_LAYERS.has(layer),
      locked,
      writable: canWrite && editor.editor !== 'readonly',
    });
  });
}

/**
 * The raw values of an edit: a string is one atom, a number or a boolean
 * its text, `{ token: path }` a token reference and an array the values
 * themselves.
 */
export function editValues(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (value && typeof value === 'object' && typeof value.token === 'string') {
    return [['token', value.token]];
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return [String(value)];
  }
  if (typeof value === 'boolean') {
    return [String(value)];
  }
  if (typeof value === 'string') {
    return [value];
  }
  return fail('bad-value', `Cannot edit a property with ${String(value)}`);
}

/** The vocabulary type of `(id, name)`, `undefined` for an unknown one. */
function typeOf(vocabulary, element, name) {
  const info = kindInfo(vocabulary, element.kind);
  if (name === element.kind) {
    return info.properties.get(info.positional[0])?.type ?? 'string';
  }
  return info.properties.get(name)?.type;
}

/** Check the values of an edit against the type of the property. */
function checkValues(type, values, positional) {
  if (values.length === 0 || values.some((v) => v === '')) {
    fail('bad-value', 'A property needs a value; use Reset to remove it');
  }
  if (positional && values.some((v) => typeof v !== 'string')) {
    fail('bad-value', 'Positional values are atoms');
  }
  if (type === 'action' || (type === undefined && positional)) {
    fail('not-editable', 'Actions are not edited in dev mode');
  }
  if (type === undefined || type === 'any') {
    return;
  }
  if (values.length !== 1 || !valueMatches(type, values[0])) {
    const expected = Array.isArray(type) ? type.slice(1).join(', ') : type;
    fail(
      'bad-value',
      `${formatValues(values)} is not a valid value (expected ${expected})`
    );
  }
}

/**
 * The layer an edit writes, checked against the policy: `site`, `theme`
 * and `defaults` are never written, and `user`/`session` only when the
 * policy lists them.
 */
function writableLayer(policy, layer) {
  const target = layer ?? topWritableLayer(policy);
  if (READ_ONLY_LAYERS.includes(target)) {
    fail(
      'read-only-layer',
      `Dev mode never writes the ${target} layer; edit user or session`
    );
  }
  if (!target || !policy.writeLayers.includes(target)) {
    fail(
      'read-only-layer',
      `The site policy does not let dev mode write the ${target ?? 'any'} layer`
    );
  }
  return target;
}

/**
 * The element of an edit: `options.getElement(id)`, else the element of
 * `options.document` (a ui-store store or a ui-core document).
 */
function elementOf(options, id) {
  const { getElement, document } = options;
  const element =
    getElement?.(id) ??
    (typeof document?.get === 'function'
      ? document.get(id)
      : document?.byId?.get(id)) ??
    null;
  if (!element) {
    fail('unknown-element', `The document has no element "${id}"`);
  }
  return element;
}

/**
 * Write one property in a writable layer, after checking the layer against
 * the policy, the element against `(locked-elements …)` and the value
 * against the vocabulary type of the property.
 * @param {object} config  a ui-config configuration
 * @param {{ id: string, name: string, key?: string|null, value: unknown,
 *   layer?: string }} edit
 * @param {{ policy: import('./policy.js').DevModePolicy, vocabulary?: object,
 *   parentOf?: (id: string) => string|null,
 *   document?: object,
 *   getElement?: (id: string) => object|undefined }} options  the element
 *   is looked up with `getElement` or in `document` (a ui-store store or a
 *   ui-core document)
 * @returns {{ id: string, name: string, key: string|null, layer: string,
 *   values: readonly unknown[] }}
 * @throws {DevModeError}
 */
export function applyEdit(config, edit, options) {
  const { policy } = options;
  const layer = writableLayer(policy, edit.layer);
  const { id, name } = edit;
  const element = elementOf(options, id);
  if (isLocked(policy, id, options.parentOf)) {
    fail('locked-element', `"${id}" is locked by the site policy`);
  }
  const vocabulary = options.vocabulary ?? defaultVocabulary();
  const values = editValues(edit.value);
  checkValues(typeOf(vocabulary, element, name), values, name === element.kind);
  const key = edit.key ?? null;
  config.set(layer, id, name, values, key ?? undefined);
  return Object.freeze({ id, name, key, layer, values });
}

/**
 * Reset a property: remove it from the highest writable layer that holds
 * it, so the value of the layer below shows again. The element is locked
 * when it or an ancestor (`parentOf`) is in `(locked-elements …)`.
 * @param {object} config  a ui-config configuration
 * @param {{ id: string, name: string, key?: string|null }} target
 * @param {{ policy: import('./policy.js').DevModePolicy,
 *   parentOf?: (id: string) => string|null }} options
 * @returns {string|null}  the layer the value was removed from
 */
export function resetProperty(
  config,
  { id, name, key = null },
  { policy, parentOf }
) {
  if (isLocked(policy, id, parentOf)) {
    fail('locked-element', `"${id}" is locked by the site policy`);
  }
  for (const layer of [...policy.writeLayers].reverse()) {
    if (config.valueIn(layer, id, name, key ?? undefined) !== undefined) {
      config.unset(layer, id, name, key ?? undefined);
      return layer;
    }
  }
  return null;
}

/**
 * Save: move every session override to the user layer (which ui-config
 * persists), then clear the session.
 * @returns {number}  the number of overrides moved
 */
export function saveSession(config, { policy }) {
  if (!policy.writeLayers.includes('user')) {
    fail('read-only-layer', 'The site policy does not allow saving');
  }
  const moved = config.overrides('session');
  for (const o of moved) {
    config.set('user', o.id, o.name, o.values, o.key ?? undefined);
  }
  config.clear('session');
  return moved.length;
}

/** Discard: clear the session layer. */
export function discardSession(config) {
  const count = config.overrides('session').length;
  config.clear('session');
  return count;
}
