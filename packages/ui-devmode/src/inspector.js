/**
 * The inspector panel: a host docked to the right of the page, resizable,
 * whose shadow root holds the layout of `inspector.lino` rendered by ui-dom
 * with the dev mode kinds below. Every text comes from the message table.
 *
 * The panel knows nothing of the page: `session.js` fills its views and
 * reacts to its commands.
 */

import { mountDocument } from '@link-foundation/ui-dom';
import { INSPECTOR_CSS } from './inspector-css.js';

/** The width of the panel, in CSS pixels. */
export const WIDTH = Object.freeze({ initial: 420, min: 280, step: 16 });

const kind = (properties, children = 'any') => ({
  positional: [],
  properties: new Map(
    properties.map((name) => [name, { type: 'string', multi: false }])
  ),
  children,
});

/**
 * The vocabulary of `inspector.lino`: the dev mode kinds and their
 * properties (all text, message keys or names).
 */
export const LAYOUT_VOCABULARY = Object.freeze({
  version: null,
  kinds: new Map([
    ['devmode-panel', kind(['label'])],
    ['devmode-heading', kind(['label'], 'none')],
    ['devmode-toolbar', kind(['label'])],
    ['devmode-action', kind(['label', 'command', 'toggle'], 'none')],
    ['devmode-status', kind(['label', 'role'], 'none')],
    ['devmode-tabs', kind(['label'])],
    ['devmode-tab', kind(['label', 'view'], 'none')],
  ]),
  actions: new Map(),
  multiValued: new Set(),
});

const text = (el, name) => {
  const value = el.props.get(name)?.[0];
  return typeof value === 'string' ? value : undefined;
};

/** The translated `label` of a layout element. */
const label = (el, ctx) => ctx.options.t(text(el, 'label') ?? '');

const make = (ctx, tag, attributes = {}) => {
  const node = ctx.document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    node.setAttribute(name, value);
  }
  return node;
};

/** The ui-dom kinds of the layout (render option `kinds`). */
export const LAYOUT_KINDS = Object.freeze({
  'devmode-panel': {
    tag: 'ui-devmode-panel',
    create: (el, ctx) =>
      make(ctx, 'ui-devmode-panel', {
        role: 'complementary',
        'aria-label': label(el, ctx),
      }),
  },
  'devmode-heading': {
    tag: 'ui-devmode-heading',
    childrenSlot: null,
    create(el, ctx) {
      const node = make(ctx, 'ui-devmode-heading', {
        role: 'heading',
        'aria-level': '2',
      });
      node.textContent = label(el, ctx);
      return node;
    },
  },
  'devmode-toolbar': {
    tag: 'ui-devmode-toolbar',
    create: (el, ctx) =>
      make(ctx, 'ui-devmode-toolbar', {
        role: 'group',
        'aria-label': label(el, ctx),
      }),
  },
  'devmode-action': {
    tag: 'ui-devmode-action',
    childrenSlot: null,
    create(el, ctx) {
      const node = make(ctx, 'ui-devmode-action');
      const button = make(ctx, 'button', {
        type: 'button',
        'data-command': text(el, 'command') ?? '',
      });
      if (text(el, 'toggle') === 'true') {
        button.setAttribute('aria-pressed', 'false');
      }
      button.textContent = label(el, ctx);
      node.append(button);
      return node;
    },
  },
  'devmode-status': {
    tag: 'ui-devmode-status',
    childrenSlot: null,
    create(el, ctx) {
      const role = text(el, 'role');
      const node = make(ctx, 'ui-devmode-status', { 'data-role': role ?? '' });
      if (role === 'live') {
        node.setAttribute('role', 'status');
      }
      node.textContent = text(el, 'label') ? label(el, ctx) : '';
      return node;
    },
  },
  'devmode-tabs': {
    tag: 'ui-devmode-tabs',
    create(el, ctx) {
      const node = make(ctx, 'ui-devmode-tabs');
      const list = make(ctx, 'div', {
        role: 'tablist',
        'aria-label': label(el, ctx),
      });
      const panels = make(ctx, 'div', { class: 'panels' });
      node.append(list, panels);
      return node;
    },
    childrenSlot: (node) => node.querySelector('.panels'),
  },
  'devmode-tab': {
    tag: 'ui-devmode-tab',
    childrenSlot: null,
    create: (el, ctx) =>
      make(ctx, 'ui-devmode-tab', {
        role: 'tabpanel',
        tabindex: '0',
        'data-view': text(el, 'view') ?? '',
        'data-label': label(el, ctx),
      }),
  },
});

/**
 * Read `inspector.lino` next to this module: with `fetch` in a browser,
 * from the file system in Node.js.
 * @returns {Promise<string>}
 */
export async function loadLayout() {
  const url = new globalThis.URL('./inspector.lino', import.meta.url);
  if (url.protocol === 'file:') {
    const { readFile } = await import('node:fs/promises');
    return readFile(url, 'utf8');
  }
  const response = await globalThis.fetch(url);
  if (!response.ok) {
    throw new Error(`Could not load ${url}: ${response.status}`);
  }
  return response.text();
}

/** Make the tab buttons of the panels and wire the WAI-ARIA tabs keys. */
function buildTabs(shadow, onChange) {
  const list = shadow.querySelector('[role="tablist"]');
  const panels = [...shadow.querySelectorAll('[role="tabpanel"]')];
  const doc = shadow.ownerDocument;
  const tabs = panels.map((panel) => {
    const view = panel.dataset.view;
    const tab = doc.createElement('button');
    tab.type = 'button';
    tab.setAttribute('role', 'tab');
    tab.id = `devmode-tab-${view}`;
    tab.dataset.view = view;
    tab.textContent = panel.dataset.label;
    panel.id = `devmode-panel-${view}`;
    tab.setAttribute('aria-controls', panel.id);
    panel.setAttribute('aria-labelledby', tab.id);
    list.append(tab);
    return tab;
  });
  const select = (view, focus = false) => {
    tabs.forEach((tab, i) => {
      const on = tab.dataset.view === view;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      panels[i].hidden = !on;
      if (on && focus) {
        tab.focus();
      }
    });
    onChange(view);
  };
  list.addEventListener('click', (event) => {
    const tab = event.target.closest?.('[role="tab"]');
    if (tab) {
      select(tab.dataset.view);
    }
  });
  list.addEventListener('keydown', (event) => {
    const at = tabs.indexOf(event.target);
    const moves = {
      ArrowRight: at + 1,
      ArrowLeft: at - 1,
      Home: 0,
      End: tabs.length - 1,
    };
    if (at < 0 || !(event.key in moves)) {
      return;
    }
    event.preventDefault();
    const next = (moves[event.key] + tabs.length) % tabs.length;
    select(tabs[next].dataset.view, true);
  });
  return { select, panels };
}

/** The WAI-ARIA window splitter on the left edge of the panel. */
function buildSplitter(host, shadow, t, window) {
  const doc = shadow.ownerDocument;
  const splitter = doc.createElement('div');
  splitter.className = 'splitter';
  splitter.tabIndex = 0;
  splitter.setAttribute('role', 'separator');
  splitter.setAttribute('aria-orientation', 'vertical');
  splitter.setAttribute('aria-label', t('resize.label'));
  splitter.setAttribute('aria-valuemin', String(WIDTH.min));
  const max = () => Math.max(WIDTH.min, Math.round(window.innerWidth * 0.9));
  const setWidth = (width) => {
    const clamped = Math.round(Math.min(max(), Math.max(WIDTH.min, width)));
    host.style.setProperty('--devmode-width', `${clamped}px`);
    splitter.setAttribute('aria-valuemax', String(max()));
    splitter.setAttribute('aria-valuenow', String(clamped));
    return clamped;
  };
  let width = setWidth(WIDTH.initial);
  splitter.addEventListener('keydown', (event) => {
    const keys = {
      ArrowLeft: width + WIDTH.step,
      ArrowRight: width - WIDTH.step,
      Home: max(),
      End: WIDTH.min,
    };
    if (event.key in keys) {
      event.preventDefault();
      width = setWidth(keys[event.key]);
    }
  });
  splitter.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    splitter.setPointerCapture?.(event.pointerId);
    const move = (e) => {
      width = setWidth(window.innerWidth - e.clientX);
    };
    const up = () => {
      splitter.removeEventListener('pointermove', move);
      splitter.removeEventListener('pointerup', up);
    };
    splitter.addEventListener('pointermove', move);
    splitter.addEventListener('pointerup', up);
  });
  return { splitter, setWidth: (w) => (width = setWidth(w)) };
}

/**
 * Create the inspector panel and append it to the page.
 * @param {{ window: Window & typeof globalThis, layout: string,
 *   t: (key: string, params?: object) => string,
 *   onCommand: (command: string) => void,
 *   onView?: (view: string) => void }} options
 */
export function createInspector({
  window,
  layout,
  t,
  onCommand,
  onView,
  container = window.document.body,
}) {
  const doc = window.document;
  const host = doc.createElement('ui-devmode-inspector');
  host.dataset.uiDevmode = 'inspector';
  const shadow = host.attachShadow({ mode: 'open' });
  const { splitter, setWidth } = buildSplitter(host, shadow, t, window);
  const frame = doc.createElement('div');
  frame.className = 'frame';
  shadow.append(splitter, frame);
  container.append(host);
  const mounted = mountDocument(frame, layout, {
    parseOptions: { vocabulary: LAYOUT_VOCABULARY },
    kinds: LAYOUT_KINDS,
    t,
    baseCss: false,
    css: INSPECTOR_CSS,
  });
  mounted.handle.flush?.();

  let view = 'outline';
  const tabs = buildTabs(shadow, (next) => {
    view = next;
    onView?.(next);
  });
  const button = (command) =>
    shadow.querySelector(`button[data-command="${command}"]`);
  shadow.addEventListener('click', (event) => {
    const target = event.target.closest?.('button[data-command]');
    if (target && !target.disabled) {
      onCommand(target.dataset.command);
    }
  });
  const status = shadow.querySelector('[data-role="live"]');
  const selection = shadow.querySelector('[data-role="selection"]');

  return {
    host,
    shadow,
    /** The panel element of a view (`outline`, `properties`, …). */
    panel: (name) =>
      shadow.querySelector(`[role="tabpanel"][data-view="${name}"]`),
    get view() {
      return view;
    },
    showView: (name, focus = false) => tabs.select(name, focus),
    setPressed(command, pressed) {
      button(command)?.setAttribute('aria-pressed', String(pressed));
    },
    setDisabled(command, disabled) {
      const target = button(command);
      if (target) {
        target.disabled = disabled;
      }
    },
    setSelection(textContent) {
      selection.textContent = textContent;
    },
    announce(textContent) {
      status.textContent = textContent;
    },
    setWidth,
    /** Whether an event happened inside the panel. */
    contains: (event) => event.composedPath?.().includes(host) ?? false,
    destroy() {
      mounted.handle.destroy();
      host.remove();
    },
  };
}
