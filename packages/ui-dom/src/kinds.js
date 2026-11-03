/**
 * The kind registry: one DOM renderer per element kind. A kind renders as a
 * custom element (`ui-KIND`) defined once per window as a plain subclass of
 * `HTMLElement`: no shadow DOM, so page styles and the adopted stylesheet
 * reach every element (light DOM).
 */

/**
 * @typedef {import('./model.js').Element} Element
 *
 * @typedef {object} KindContext
 * @property {Document} document  the document nodes are created in
 * @property {Record<string, any>} options  the render options
 * @property {(code: string, severity: 'error'|'warning'|'info',
 *   at?: Record<string, unknown>) => void} diagnostic  report a problem of
 *   the current element
 * @property {() => Element[]} children  the element models of the current
 *   element's children in the store (a kind without a children slot reads
 *   sublinks that the projection made child elements, such as `(label ...)`)
 *
 * @typedef {object} KindSpec
 * @property {string} tag  a valid custom element name (`ui-button`)
 * @property {(el: Element, ctx: KindContext) => HTMLElement} create  build
 *   the node; the renderer then calls `update` with every property
 * @property {(node: HTMLElement, el: Element, changed: string[],
 *   ctx: KindContext) => void} [update]  apply the changed properties
 * @property {null|((node: HTMLElement) => HTMLElement)} [childrenSlot]
 *   where the children go (default: the node itself; `null`: no children)
 * @property {(node: HTMLElement) => HTMLElement} [eventTarget]  the element
 *   the `(on EVENT ...)` listeners go on (default: the node)
 * @property {Record<string, 'string'|'boolean'>} [attributes]  properties
 *   mirrored as attributes for CSS (`variant` → `variant="filled"`); a
 *   boolean attribute is present for `true` and absent otherwise
 * @property {(node: HTMLElement, ctx: KindContext) => void} [destroy]
 */

const registry = new Map();

const isLower = (c) => c >= 'a' && c <= 'z';
const isNameChar = (c) =>
  isLower(c) || (c >= '0' && c <= '9') || c === '-' || c === '.' || c === '_';

/** Whether `tag` is a valid custom element name (ASCII subset). */
export function isCustomElementName(tag) {
  if (typeof tag !== 'string' || !isLower(tag[0]) || !tag.includes('-')) {
    return false;
  }
  return [...tag].every(isNameChar);
}

/** Check the optional hooks and attributes of a kind spec. */
function checkHooks(kind, spec) {
  for (const name of ['update', 'destroy', 'eventTarget']) {
    if (spec[name] !== undefined && typeof spec[name] !== 'function') {
      throw new TypeError(`defineKind(${kind}): ${name} must be a function`);
    }
  }
  const slot = spec.childrenSlot;
  if (slot !== undefined && slot !== null && typeof slot !== 'function') {
    throw new TypeError(
      `defineKind(${kind}): childrenSlot must be a function or null`
    );
  }
  for (const name of Object.keys(spec.attributes ?? {})) {
    // Event handler attributes would run text as code.
    if (name.toLowerCase().startsWith('on')) {
      throw new TypeError(
        `defineKind(${kind}): "${name}" cannot be an attribute (on* attributes run code)`
      );
    }
  }
}

/**
 * Check a kind spec; throws a `TypeError` naming the problem.
 * @param {string} kind
 * @param {KindSpec} spec
 * @returns {Readonly<KindSpec>}
 */
export function checkKind(kind, spec) {
  if (typeof kind !== 'string' || kind === '') {
    throw new TypeError('defineKind: the kind must be a non-empty string');
  }
  if (spec === null || typeof spec !== 'object') {
    throw new TypeError(`defineKind(${kind}): the spec must be an object`);
  }
  if (!isCustomElementName(spec.tag)) {
    throw new TypeError(
      `defineKind(${kind}): "${spec.tag}" is not a valid custom element name`
    );
  }
  if (typeof spec.create !== 'function') {
    throw new TypeError(`defineKind(${kind}): create must be a function`);
  }
  checkHooks(kind, spec);
  return Object.freeze({ ...spec });
}

/**
 * Register the DOM renderer of a kind (replacing an earlier one).
 * @param {string} kind
 * @param {KindSpec} spec
 * @returns {Readonly<KindSpec>}
 */
export function defineKind(kind, spec) {
  const checked = checkKind(kind, spec);
  registry.set(kind, checked);
  return checked;
}

/**
 * The renderer of a kind: `overrides` (the `kinds` render option, a Map or
 * an object) first, then the registry.
 * @param {string|null} kind
 * @param {Map<string, KindSpec>|Record<string, KindSpec>} [overrides]
 * @returns {Readonly<KindSpec>|undefined}
 */
export function getKind(kind, overrides) {
  if (kind === null || kind === undefined) {
    return undefined;
  }
  const own =
    overrides instanceof Map
      ? overrides.get(kind)
      : overrides !== undefined && Object.hasOwn(overrides, kind)
        ? overrides[kind]
        : undefined;
  return own === undefined ? registry.get(kind) : checkKind(kind, own);
}

/** The registered kinds (for documentation and tests). */
export const registeredKinds = () => [...registry.keys()];

/**
 * Define `tag` as a plain custom element in the window, unless it is
 * already defined there (by this renderer or by the page).
 * @param {Window|undefined|null} win
 * @param {string} tag
 */
export function ensureTag(win, tag) {
  const elements = win?.customElements;
  if (
    elements === null ||
    elements === undefined ||
    elements.get(tag) !== undefined
  ) {
    return;
  }
  // A fresh class per tag: one constructor cannot back two names.
  elements.define(tag, class extends win.HTMLElement {});
}
