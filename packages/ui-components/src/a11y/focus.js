/**
 * Focus management: a focus trap for modal content and focus restoration.
 * The trap moves focus itself on Tab and Shift+Tab, so it cycles in the
 * same order in every browser (and in jsdom).
 */

/** Elements that can take focus with the keyboard, before filtering. */
export const FOCUSABLE = [
  'a[href]',
  'area[href]',
  'button',
  'input',
  'select',
  'textarea',
  'iframe',
  'audio[controls]',
  'video[controls]',
  'summary',
  '[contenteditable]',
  '[tabindex]',
].join(',');

/** Whether an element or an ancestor is hidden, inert or disabled. */
function isUnavailable(element) {
  if (element.disabled === true || element.getAttribute('tabindex') === '-1') {
    return true;
  }
  if (element.localName === 'input' && element.type === 'hidden') {
    return true;
  }
  for (
    let node = element;
    node && node.nodeType === 1;
    node = node.parentElement
  ) {
    if (node.hidden || node.inert || node.hasAttribute('inert')) {
      return true;
    }
    if (node.getAttribute('aria-hidden') === 'true') {
      return true;
    }
  }
  return false;
}

/**
 * The elements of a container that Tab reaches, in Tab order: positive
 * `tabindex` first (ascending), then document order.
 * @param {Element} container
 * @returns {HTMLElement[]}
 */
export function tabbables(container) {
  const found = [...container.querySelectorAll(FOCUSABLE)].filter(
    (element) =>
      !isUnavailable(element) &&
      element.getAttribute('contenteditable') !== 'false'
  );
  const order = (element) => Math.max(0, element.tabIndex || 0);
  return found
    .map((element, index) => ({ element, index }))
    .sort((a, b) => {
      const [x, y] = [order(a.element), order(b.element)];
      if (x === y) {
        return a.index - b.index;
      }
      if (x === 0 || y === 0) {
        return x === 0 ? 1 : -1;
      }
      return x - y;
    })
    .map(({ element }) => element);
}

/**
 * Focus an element if it is still in the document; returns whether it was
 * focused.
 * @param {Element|null|undefined} previous
 */
export function restoreFocus(previous) {
  if (
    !previous ||
    !previous.isConnected ||
    typeof previous.focus !== 'function'
  ) {
    return false;
  }
  previous.focus();
  return previous.ownerDocument.activeElement === previous;
}

/**
 * Keep keyboard focus inside a container: Tab after the last tabbable
 * element goes to the first one, Shift+Tab before the first goes to the
 * last, and focus that leaves the container (a click outside, a script)
 * comes back. Focus moves into the container at once.
 * @param {HTMLElement} container
 * @param {{initialFocus?: HTMLElement|null, restore?: boolean}} [options]
 *   `initialFocus` (default: the first tabbable element, else the
 *   container); `restore` (default `true`): `release` focuses the element
 *   that had focus before the trap
 * @returns {() => void} release
 */
export function trapFocus(container, options = {}) {
  const document = container.ownerDocument;
  const previous = document.activeElement;
  const { restore = true } = options;

  const focusEdge = (last) => {
    const items = tabbables(container);
    const target = last ? items.at(-1) : items[0];
    if (target) {
      target.focus();
    } else {
      if (!container.hasAttribute('tabindex')) {
        container.setAttribute('tabindex', '-1');
      }
      container.focus();
    }
  };

  const onKeyDown = (event) => {
    if (event.key !== 'Tab' || event.ctrlKey || event.altKey || event.metaKey) {
      return;
    }
    const items = tabbables(container);
    event.preventDefault();
    if (items.length === 0) {
      focusEdge(false);
      return;
    }
    const index = items.indexOf(document.activeElement);
    const step = event.shiftKey ? -1 : 1;
    const next =
      index === -1
        ? event.shiftKey
          ? items.length - 1
          : 0
        : (index + step + items.length) % items.length;
    items[next].focus();
  };

  const onFocusIn = (event) => {
    if (!container.contains(event.target)) {
      focusEdge(false);
    }
  };

  container.addEventListener('keydown', onKeyDown);
  document.addEventListener('focusin', onFocusIn);
  const initial = options.initialFocus;
  if (initial && container.contains(initial)) {
    initial.focus();
  } else if (!container.contains(document.activeElement)) {
    focusEdge(false);
  }

  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    container.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('focusin', onFocusIn);
    if (restore) {
      restoreFocus(previous);
    }
  };
}
