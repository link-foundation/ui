/**
 * The tab strip of a tab group and of a dock region (WAI-ARIA APG tabs
 * pattern, automatic activation).
 *
 * - Left and Right move between the tabs and select them, Home and End
 *   go to the first and the last tab; one tab is in the tab order.
 * - Delete closes a closable tab.
 * - Ctrl+Shift+Left and Ctrl+Shift+Right move the tab (reorder); so does
 *   dragging it to another place in the strip.
 * - A tab can be dragged to another strip (another dock region).
 * - When the tabs do not fit, the "More tabs" menu lists them all.
 * - An optional "Panel actions" menu acts on the selected tab.
 */

import { make, uid } from './dom.js';
import { menuButton } from './menu.js';

/** The panel id of the tab dragged right now (shared by all strips). */
let dragging = null;

const KEY_MOVES = {
  ArrowLeft: -1,
  ArrowRight: 1,
};

/**
 * @typedef {object} Tab
 * @property {string} id  the panel id
 * @property {string} title
 * @property {string} panel  the DOM id of the tab panel
 * @property {boolean} closable
 *
 * @typedef {object} StripHandlers
 * @property {(id: string) => void} select
 * @property {(id: string) => void} [close]
 * @property {(order: string[]) => void} [reorder]
 * @property {(id: string, index: number) => void} [receive]  a tab of
 *   another strip was dropped here
 * @property {(id: string) => {label: string, run: () => void}[]} [actions]
 */

const order = (strip) => strip.tabs.map((t) => t.id);
const focusTab = (strip, id) => strip.buttons.get(id)?.focus();

/** Move tab `id` to index `to` and keep the focus on it. */
function reorder(strip, id, to) {
  const ids = order(strip).filter((t) => t !== id);
  ids.splice(Math.max(0, Math.min(to, ids.length)), 0, id);
  strip.spec.reorder?.(ids);
  focusTab(strip, id);
}

function selectAndFocus(strip, id) {
  strip.spec.select(id);
  focusTab(strip, id);
}

/** The keys of a tab; true when the key was used. */
function onKey(strip, event, tab) {
  const { spec } = strip;
  const ids = order(strip);
  const at = ids.indexOf(tab.id);
  const move = KEY_MOVES[event.key];
  if (move !== undefined && event.ctrlKey && event.shiftKey) {
    if (spec.reorderable !== false) {
      reorder(strip, tab.id, at + move);
    }
  } else if (move !== undefined) {
    selectAndFocus(strip, ids[(at + move + ids.length) % ids.length]);
  } else if (event.key === 'Home' || event.key === 'End') {
    selectAndFocus(strip, event.key === 'Home' ? ids[0] : ids.at(-1));
  } else if (event.key === 'Delete' && tab.closable && spec.close) {
    spec.close(tab.id);
  } else {
    return;
  }
  event.preventDefault();
}

/** A dragged tab dropped before tab `before` (`null`: at the end). */
function onDrop(strip, event, before) {
  if (dragging === null) {
    return;
  }
  event.preventDefault();
  const { id } = dragging;
  dragging = null;
  const ids = order(strip);
  const target = before === null ? ids.length : ids.indexOf(before);
  if (ids.includes(id)) {
    if (strip.spec.reorderable !== false) {
      const from = ids.indexOf(id);
      reorder(strip, id, from < target ? target - 1 : target);
    }
  } else {
    strip.spec.receive?.(id, target);
  }
}

function listenDrag(strip, button) {
  button.addEventListener('dragstart', (event) => {
    dragging = { id: button.dataset.panel };
    event.dataTransfer?.setData('text/plain', button.dataset.panel);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  });
  button.addEventListener('dragend', () => {
    dragging = null;
  });
  button.addEventListener('dragover', (event) => event.preventDefault());
  button.addEventListener('drop', (event) => {
    event.stopPropagation();
    onDrop(strip, event, button.dataset.panel);
  });
}

function makeTab(strip) {
  const button = make(strip.document, 'button', {
    type: 'button',
    role: 'tab',
    id: uid('ui-tab'),
    draggable: 'true',
  });
  button.append(make(strip.document, 'span', { class: 'ui-tab-title' }));
  button.addEventListener('click', (event) => {
    if (event.target.closest?.('.ui-tab-close')) {
      strip.spec.close?.(button.dataset.panel);
      return;
    }
    strip.spec.select(button.dataset.panel);
  });
  button.addEventListener('keydown', (event) =>
    onKey(
      strip,
      event,
      strip.tabs.find((t) => t.id === button.dataset.panel)
    )
  );
  listenDrag(strip, button);
  return button;
}

/** Write a tab: its title, its selection and its close mark. */
function drawTab(strip, button, tab, selected) {
  button.dataset.panel = tab.id;
  button.firstChild.textContent = tab.title;
  const on = tab.id === selected;
  button.setAttribute('aria-selected', String(on));
  button.setAttribute('aria-controls', tab.panel);
  button.tabIndex = on ? 0 : -1;
  let close = button.querySelector('.ui-tab-close');
  if (tab.closable && close === null) {
    // Not a button: a tab cannot hold another control. Delete closes the
    // tab from the keyboard.
    close = make(
      strip.document,
      'span',
      {
        class: 'ui-tab-close',
        'aria-hidden': 'true',
        title: `Close ${tab.title}`,
      },
      '×'
    );
    button.append(close);
  } else if (!tab.closable) {
    close?.remove();
  }
}

/** The "More tabs" menu (shown when the tabs overflow) and the actions. */
function makeMenus(strip) {
  const { document, spec, element } = strip;
  strip.overflow = menuButton(document, {
    label: `More tabs of ${spec.label}`,
    text: '⋯',
    className: 'ui-tab-overflow',
    items: () =>
      strip.tabs.map((tab) => ({
        label: tab.title,
        run: () => selectAndFocus(strip, tab.id),
      })),
  });
  strip.overflow.hidden = true;
  element.append(strip.overflow);
  strip.actions = null;
  if (spec.actions) {
    strip.actions = menuButton(document, {
      label: `Panel actions of ${spec.label}`,
      text: '⋮',
      className: 'ui-tab-actions',
      items: () => (strip.active === null ? [] : spec.actions(strip.active)),
    });
    element.append(strip.actions);
  }
}

/** Show the "More tabs" menu only when the tabs do not fit. */
function checkOverflow(strip) {
  strip.overflow.hidden = !(
    strip.list.scrollWidth >
    strip.list.clientWidth + 1
  );
}

/** Draw the tabs; `selected` is the selected panel id. */
function renderStrip(strip, tabs, selected) {
  const { buttons, list } = strip;
  strip.tabs = tabs;
  strip.active = selected;
  for (const [id, button] of buttons) {
    if (!tabs.some((t) => t.id === id)) {
      button.remove();
      buttons.delete(id);
    }
  }
  tabs.forEach((tab, i) => {
    let button = buttons.get(tab.id);
    if (button === undefined) {
      button = makeTab(strip);
      buttons.set(tab.id, button);
    }
    drawTab(strip, button, tab, selected);
    if (list.children[i] !== button) {
      list.insertBefore(button, list.children[i] ?? null);
    }
  });
  if (strip.actions !== null) {
    strip.actions.hidden = selected === null;
  }
  checkOverflow(strip);
}

/**
 * Make a tab strip.
 * @param {Document} document
 * @param {{label: string, reorderable?: boolean} & StripHandlers} spec
 */
export function createTabStrip(document, spec) {
  const element = make(document, 'div', { class: 'ui-tab-strip' });
  const list = make(document, 'div', {
    role: 'tablist',
    'aria-label': spec.label,
  });
  element.append(list);
  /** @type {{tabs: Tab[]} & Record<string, any>} */
  const strip = {
    document,
    spec,
    element,
    list,
    tabs: [],
    active: null,
    buttons: new Map(),
  };
  list.addEventListener('dragover', (event) => event.preventDefault());
  list.addEventListener('drop', (event) => onDrop(strip, event, null));
  makeMenus(strip);
  const win = document.defaultView;
  const resizeObserver =
    typeof win?.ResizeObserver === 'function'
      ? new win.ResizeObserver(() => checkOverflow(strip))
      : null;
  resizeObserver?.observe(list);
  return {
    element,
    render: (tabs, selected) => renderStrip(strip, tabs, selected),
    focusTab: (id) => focusTab(strip, id),
    /** The DOM id of the tab of a panel. */
    tabId: (id) => strip.buttons.get(id)?.id ?? null,
    disconnect: () => resizeObserver?.disconnect(),
  };
}
