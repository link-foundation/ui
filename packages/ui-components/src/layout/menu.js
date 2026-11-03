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

/** Move the focus among the enabled items. */
function moveFocus(items, current, key) {
  const enabled = items.filter((item) => !item.disabled);
  if (enabled.length === 0) {
    return;
  }
  const at = enabled.indexOf(current);
  const next = {
    ArrowDown: enabled[(at + 1) % enabled.length],
    ArrowUp: enabled[(at - 1 + enabled.length) % enabled.length],
    Home: enabled[0],
    End: enabled[enabled.length - 1],
  }[key];
  next?.focus();
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
  button.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open.has(button)) {
        toggle(event.key === 'ArrowUp');
      }
    }
  });
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
  const focusables = items.map((item) => {
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
    return {
      node,
      disabled: item.disabled === true,
      focus: () => node.focus(),
    };
  });
  element.append(...focusables.map((f) => f.node));
  element.addEventListener('keydown', (event) => {
    const current = focusables.find((f) => f.node === event.target);
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      moveFocus(focusables, current, event.key);
    } else if (event.key === 'Escape') {
      closeMenu(button);
    } else if (event.key === 'Tab') {
      closeMenu(button, { restoreFocus: false });
      return;
    } else {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
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
  const enabled = focusables.filter((f) => !f.disabled);
  (options.focusLast ? enabled[enabled.length - 1] : enabled[0])?.focus();
  return element;
}
