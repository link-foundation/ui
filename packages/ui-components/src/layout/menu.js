/**
 * A small menu button popup (WAI-ARIA APG menu button pattern), used by the
 * tab strip overflow menu and the panel actions of a dock.
 *
 * `openMenu(button, items)` shows `role="menu"` after the button with one
 * `role="menuitem"` per item and focuses the first one. Up and Down move
 * between the items (Home and End to the ends), Enter and Space choose one,
 * and Escape or Tab close the menu; focus goes back to the button, unless
 * the chosen action moved it.
 */

import { bindKeys } from '../a11y/keys.js';
import { createRovingTabindex } from '../a11y/roving.js';
import { make } from './dom.js';

const open = new WeakMap();

/** Close the menu of a button, if it is open. */
export function closeMenu(button, { restoreFocus = true } = {}) {
  const menu = open.get(button);
  if (menu === undefined) {
    return;
  }
  open.delete(button);
  menu.cleanup();
  menu.element.remove();
  button.setAttribute('aria-expanded', 'false');
  if (restoreFocus) {
    button.focus();
  }
}

/**
 * A menu button: a `button` with `aria-haspopup="menu"` that opens the
 * menu of `items()` (called each time it opens).
 * @param {Document} document
 * @param {{label: string, text: string, className?: string,
 *   items: () => {label: string, run: () => void, disabled?: boolean}[]}} spec
 */
export function menuButton(document, { label, text, className, items }) {
  const button = make(
    document,
    'button',
    {
      type: 'button',
      class: className,
      'aria-label': label,
      'aria-haspopup': 'menu',
      'aria-expanded': 'false',
    },
    text
  );
  const toggle = (focusLast = false) => {
    if (open.has(button)) {
      closeMenu(button);
    } else {
      openMenu(button, items(), { focusLast });
    }
  };
  button.addEventListener('click', () => toggle());
  const openWith = (focusLast) => () => {
    if (!open.has(button)) {
      toggle(focusLast);
    }
  };
  bindKeys(button, { ArrowDown: openWith(false), ArrowUp: openWith(true) });
  return button;
}

/**
 * Open a menu for `button`.
 * @param {HTMLElement} button
 * @param {{label: string, run: () => void, disabled?: boolean}[]} items
 * @param {{focusLast?: boolean}} [options]
 */
export function openMenu(button, items, options = {}) {
  closeMenu(button, { restoreFocus: false });
  const document = button.ownerDocument;
  const element = make(document, 'div', {
    class: 'ui-menu',
    role: 'menu',
    'aria-label': button.getAttribute('aria-label'),
  });
  const nodes = items.map((item) => {
    const node = make(
      document,
      'button',
      {
        type: 'button',
        role: 'menuitem',
        tabindex: '-1',
        'aria-disabled': item.disabled ? 'true' : undefined,
      },
      item.label
    );
    node.addEventListener('click', () => {
      if (item.disabled) {
        return;
      }
      closeMenu(button);
      item.run();
    });
    return node;
  });
  element.append(...nodes);
  // Up, Down, Home and End move among the enabled items (around the ends).
  const roving = createRovingTabindex(nodes, { orientation: 'vertical' });
  roving.attach(element);
  // The keys of an open menu stay in it (a menu in a window keeps Escape).
  bindKeys(element, {
    Escape: (event) => {
      event.stopPropagation();
      closeMenu(button);
    },
    Tab: () => {
      closeMenu(button, { restoreFocus: false });
      return false;
    },
    'Shift+Tab': () => {
      closeMenu(button, { restoreFocus: false });
      return false;
    },
  });
  const onOutside = (event) => {
    if (!element.contains(event.target) && event.target !== button) {
      closeMenu(button, { restoreFocus: false });
    }
  };
  document.addEventListener('pointerdown', onOutside, true);
  button.after(element);
  button.setAttribute('aria-expanded', 'true');
  open.set(button, {
    element,
    cleanup: () => document.removeEventListener('pointerdown', onOutside, true),
  });
  const enabled = (node) => node.getAttribute('aria-disabled') !== 'true';
  roving.focus(
    options.focusLast ? nodes.findLastIndex(enabled) : nodes.findIndex(enabled)
  );
  return element;
}
