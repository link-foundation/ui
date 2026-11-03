/**
 * The three ways into dev mode: a keyboard shortcut (`Alt+Shift+D` by
 * default), the `?ui-dev` URL parameter and a `<ui-dev-mode>` element in
 * the page. This module is small on purpose: it is the only part of dev mode
 * a page loads before dev mode is opened.
 */

/** The URL parameter that opens dev mode on load. */
export const URL_PARAMETER = 'ui-dev';

/** The custom element that opens dev mode when it is connected. */
export const ELEMENT_NAME = 'ui-dev-mode';

/** The event a connected `<ui-dev-mode>` element dispatches. */
export const REQUEST_EVENT = 'ui-dev-mode-request';

/** `?ui-dev=false` (or `0`, `off`, `no`) keeps dev mode closed. */
const OFF_VALUES = new Set(['false', '0', 'off', 'no']);

/** Modifier names of a shortcut and the `KeyboardEvent` flag of each. */
const MODIFIERS = {
  alt: 'altKey',
  option: 'altKey',
  shift: 'shiftKey',
  ctrl: 'ctrlKey',
  control: 'ctrlKey',
  meta: 'metaKey',
  cmd: 'metaKey',
  command: 'metaKey',
};

/**
 * @typedef {object} Shortcut
 * @property {boolean} altKey
 * @property {boolean} shiftKey
 * @property {boolean} ctrlKey
 * @property {boolean} metaKey
 * @property {string} code  a `KeyboardEvent.code` such as `KeyD`
 */

/**
 * The `KeyboardEvent.code` of a key name: `D` is `KeyD`, `7` is `Digit7`;
 * any other name (`F12`, `Backquote`) is a code already.
 */
function keyCode(name) {
  if (name.length === 1) {
    const upper = name.toUpperCase();
    if (upper >= 'A' && upper <= 'Z') {
      return `Key${upper}`;
    }
    if (upper >= '0' && upper <= '9') {
      return `Digit${upper}`;
    }
  }
  return name;
}

/**
 * Read a shortcut such as `Alt+Shift+D`. The key is matched by
 * `KeyboardEvent.code` (the physical key), so the shortcut works on every
 * keyboard layout, also where `Alt` changes `event.key` (macOS).
 * @param {string} text
 * @returns {Shortcut}
 */
export function parseShortcut(text) {
  const parts = String(text)
    .split('+')
    .map((part) => part.trim())
    .filter((part) => part !== '');
  const shortcut = {
    altKey: false,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    code: '',
  };
  for (const part of parts) {
    const flag = MODIFIERS[part.toLowerCase()];
    if (flag === undefined) {
      shortcut.code = keyCode(part);
    } else {
      shortcut[flag] = true;
    }
  }
  if (shortcut.code === '') {
    throw new TypeError(`The shortcut "${text}" names no key`);
  }
  return Object.freeze(shortcut);
}

/**
 * Whether a key event is the shortcut (every modifier must match).
 * @param {Pick<KeyboardEvent, 'code'|'altKey'|'shiftKey'|'ctrlKey'|'metaKey'>} event
 * @param {Shortcut} shortcut
 */
export const matchesShortcut = (event, shortcut) =>
  event.code === shortcut.code &&
  Boolean(event.altKey) === shortcut.altKey &&
  Boolean(event.shiftKey) === shortcut.shiftKey &&
  Boolean(event.ctrlKey) === shortcut.ctrlKey &&
  Boolean(event.metaKey) === shortcut.metaKey;

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/**
 * Whether a node is a place where the user types: `input`, `textarea`,
 * `select` or inside `[contenteditable]`.
 * @param {unknown} node
 */
export function isEditableTarget(node) {
  const element = /** @type {any} */ (node);
  if (!element || typeof element.tagName !== 'string') {
    return false;
  }
  if (EDITABLE_TAGS.has(element.tagName.toUpperCase())) {
    return true;
  }
  return Boolean(
    element.isContentEditable ||
    element.closest?.('[contenteditable]:not([contenteditable="false"])')
  );
}

/** The innermost target of an event, also inside a shadow root. */
export const eventTarget = (event) =>
  (typeof event.composedPath === 'function' ? event.composedPath()[0] : null) ??
  event.target;

/**
 * Whether dev mode opens on page load. Pure: the shortcut is a later user
 * action, so only the URL parameter and the element count here.
 * @param {{ url: string|URL, policy: import('./policy.js').DevModePolicy,
 *   hasElement?: boolean }} input
 * @returns {boolean}
 */
export function shouldActivate({ url, policy, hasElement = false }) {
  if (!policy.enabled) {
    return false;
  }
  if (hasElement && policy.entry.has('element')) {
    return true;
  }
  if (!policy.entry.has('url-parameter')) {
    return false;
  }
  const params = new URL(String(url), 'http://localhost/').searchParams;
  return (
    params.has(URL_PARAMETER) &&
    !OFF_VALUES.has(params.get(URL_PARAMETER).toLowerCase())
  );
}

/**
 * Define `<ui-dev-mode>` once per window. Returns `false` when it was
 * defined already (an element in the page is then not upgraded again).
 */
function defineElement(window) {
  const registry = window.customElements;
  if (!registry || registry.get(ELEMENT_NAME)) {
    return false;
  }
  const Event = window.CustomEvent;
  registry.define(
    ELEMENT_NAME,
    class UiDevMode extends window.HTMLElement {
      connectedCallback() {
        this.dispatchEvent(
          new Event(REQUEST_EVENT, { bubbles: true, composed: true })
        );
      }
    }
  );
  return true;
}

/**
 * Install the entry points the policy allows: the key listener, the URL
 * parameter (read once, now) and the `<ui-dev-mode>` element. A disabled
 * policy installs nothing.
 *
 * `onActivate(entry)` is called with `'url-parameter'` or `'element'`;
 * the shortcut calls `onToggle('shortcut')` when given, else `onActivate`.
 * The shortcut is ignored while the focus is in an editable field.
 * @param {{ window: Window & typeof globalThis,
 *   policy: import('./policy.js').DevModePolicy,
 *   onActivate: (entry: string) => void,
 *   onToggle?: (entry: string) => void }} options
 * @returns {() => void}  removes the listeners
 */
export function installActivation({ window, policy, onActivate, onToggle }) {
  if (!policy.enabled) {
    return () => {};
  }
  const cleanups = [];
  const listen = (target, type, listener, capture) => {
    target.addEventListener(type, listener, capture);
    cleanups.push(() => target.removeEventListener(type, listener, capture));
  };
  if (policy.entry.has('shortcut')) {
    const shortcut = parseShortcut(policy.shortcut);
    listen(
      window,
      'keydown',
      (event) => {
        if (
          event.defaultPrevented ||
          event.repeat ||
          !matchesShortcut(event, shortcut) ||
          isEditableTarget(eventTarget(event))
        ) {
          return;
        }
        event.preventDefault();
        (onToggle ?? onActivate)('shortcut');
      },
      true
    );
  }
  if (policy.entry.has('element')) {
    listen(window, REQUEST_EVENT, () => onActivate('element'), false);
    // Defining the element upgrades the ones in the page, which request
    // dev mode; an element of an earlier definition has to be looked up.
    if (
      !defineElement(window) &&
      window.document.querySelector(ELEMENT_NAME) !== null
    ) {
      onActivate('element');
    }
  }
  if (shouldActivate({ url: window.location.href, policy })) {
    onActivate('url-parameter');
  }
  return () => cleanups.splice(0).forEach((cleanup) => cleanup());
}
