/** Shared controller of the listbox, tree and grid, preserving native scrolling. */
import { expandTree } from './tree.js';
import { drawRow, refreshData } from './render-data.js';
import { dataKeydown } from './keyboard.js';
import { defineKind } from '@link-foundation/ui-dom';
import {
  atomOf,
  controllerOf,
  dropController,
  flagOf,
  isLive,
  make,
  numberOf,
} from '../layout/dom.js';
import { createTypeahead } from '../a11y/typeahead.js';
import { selectData, focusData } from './selection-dom.js';
import { itemKey, sourceOf } from './source.js';
import { createViewport } from './viewport.js';
import { createTableHeader } from './table.js';

const roles = { list: 'listbox', tree: 'tree', table: 'grid' };

function createData(node, el, ctx, kind) {
  const document = ctx.document;
  const root = make(document, 'div', { class: 'ui-data-scroll' });
  const body = make(document, 'div', {
    class: 'ui-data-body',
    role: 'presentation',
  });
  const status = make(document, 'div', {
    class: 'ui-data-status',
    role: 'status',
    'aria-live': 'polite',
  });
  const caption = make(document, 'div', { class: 'ui-data-caption' });
  node.append(caption, root, status);
  const state = {
    node,
    root,
    body,
    document,
    el,
    kind,
    options: ctx.options.data ?? {},
    active: null,
    cell: 0,
    selected: new Set(),
    anchor: null,
    expanded: new Set(),
    loaded: new Map(),
    pending: new Map(),
    failures: new Map(),
    widths: new Map(),
    sort: null,
    items: [],
    columns: [],
    disposed: false,
  };
  let header;
  let unsubscribe;
  const mode = () => atomOf(state.el, 'selection') ?? 'single';
  const label = (item) => String(item.label ?? item.name ?? item.id);
  const typeahead = createTypeahead(() => state.items.map(label), {
    clock: state.options.clock,
  });

  state.send = (type, detail) => {
    const event = new document.defaultView.CustomEvent(`ui-${type}`, {
      bubbles: true,
      composed: true,
      detail,
    });
    node.dispatchEvent(event);
  };
  const select = (item, event) => selectData(state, item, event);
  const focus = (index, event, selectOnMove) =>
    focusData(state, index, event, selectOnMove);
  state.expand = (item, open) => expandTree(state, item, open);

  state.trackSizes = () =>
    state.columns
      .map((c) => `${state.widths.get(c.name) ?? c.width}px`)
      .join(' ');
  if (kind === 'table') {
    header = createTableHeader(state);
  }
  root.append(body);
  const viewport = createViewport(root, body, {
    estimate: numberOf(el, 'item-height', 32),
    virtualized: flagOf(el, 'virtualized', true),
    draw: (row, item, index) => drawRow(state, row, item, index),
    changed: () => header?.render(),
  });

  Object.assign(state, {
    viewport,
    status,
    caption,
    header,
    ctx,
    mode,
    label,
    typeahead,
    select,
    focus,
  });
  state.refresh = () => refreshData(state);

  const click = (event) => {
    if (event.target.closest?.('[data-sort], .ui-data-resize')) {
      return;
    }
    const row = event.target.closest?.('[data-key]');
    const index = state.items.findIndex(
      (item) => itemKey(item) === row?.dataset.key
    );
    if (index < 0) {
      return;
    }
    state.cell = Number(
      event.target.closest?.('[data-cell]')?.dataset.cell ?? 0
    );
    focus(index);
    select(state.items[index], event);
    if (kind === 'tree' && state.items[index]._tree.branch) {
      state.expand(state.items[index]);
    }
  };
  const activate = (event) => activateData(state, event);
  state.activate = activate;
  const keydown = (event) => dataKeydown(state, event);
  node.addEventListener('click', click);
  node.addEventListener('dblclick', activate);
  node.addEventListener('keydown', keydown);
  const onFocus = (event) => focusChanged(state, event);
  node.addEventListener('focusin', onFocus);

  return {
    state,
    viewport,
    update(next) {
      state.el = next;
      const nextSource = sourceOf(next, state.options);
      if (state.source !== nextSource) {
        unsubscribe?.();
        state.source = nextSource;
        unsubscribe = nextSource?.subscribe?.(() => state.refresh());
      }
      state.refresh();
    },
    disconnect() {
      state.disposed = true;
      unsubscribe?.();
      viewport.disconnect();
      header?.disconnect();
      typeahead.reset();
      for (const abort of state.pending.values()) {
        abort.abort();
      }
      node.removeEventListener('click', click);
      node.removeEventListener('dblclick', activate);
      node.removeEventListener('keydown', keydown);
      node.removeEventListener('focusin', onFocus);
    },
  };
}

/** Register one data kind. Import the data entry point to register all three. */
export function registerDataKind(kind) {
  defineKind(kind, {
    tag: `ui-${kind}`,
    childrenSlot: null,
    create: (el, ctx) => ctx.document.createElement(`ui-${kind}`),
    update(node, el, changed, ctx) {
      if (isLive(ctx)) {
        controllerOf(node, () => createData(node, el, ctx, kind)).update(el);
      } else {
        node.setAttribute('role', roles[kind]);
        node.setAttribute(
          'aria-label',
          atomOf(el, 'label') ?? atomOf(el, 'caption') ?? kind
        );
      }
    },
    destroy: dropController,
  });
}
registerDataKind('list');

function activateData(state, event) {
  const item = state.items.find((item) => itemKey(item) === state.active);
  if (item) {
    state.send('activate', { item, originalEvent: event.type });
  }
}

function focusChanged(state, event) {
  const { node, viewport } = state;
  if (event.target.closest?.('.ui-data-header')) {
    state.inHeader = true;
    state.cell = [...state.header.header.children].indexOf(
      event.target.closest('[role=columnheader]')
    );
    viewport.render();
    return;
  }
  const row = event.target.closest?.('[data-key]');
  if (row && node.contains(row)) {
    state.inHeader = false;
    state.active = row.dataset.key;
    state.cell = Number(event.target.dataset.cell ?? 0);
    viewport.setActive(state.active);
    viewport.render();
  }
}
