import { atomOf, flagOf } from '../layout/dom.js';
import { itemKey, itemsOf } from './source.js';
import { sortItems } from './sort-model.js';
import { flattenTree } from './tree-model.js';
import { columnsOf, drawCells } from './table.js';
const roles = { list: 'listbox', tree: 'tree', table: 'grid' };
const rowRoles = { list: 'option', tree: 'treeitem', table: 'row' };

export function drawRow(state, row, item, index) {
  const { kind, document, label } = state;
  const key = itemKey(item);
  row.setAttribute('role', rowRoles[kind]);
  row.setAttribute('aria-selected', String(state.selected.has(key)));
  row.tabIndex = kind !== 'table' && key === state.active ? 0 : -1;
  if (kind === 'table') {
    drawCells(state, row, item, index);
  } else {
    row.setAttribute('aria-setsize', item._tree?.size ?? state.items.length);
    row.setAttribute('aria-posinset', item._tree?.position ?? index + 1);
    if (kind === 'tree') {
      row.setAttribute('aria-level', item._tree.level);
      row.style.paddingInlineStart = `${(item._tree.level - 1) * 20 + 8}px`;
      if (item._tree.branch) {
        row.setAttribute('aria-expanded', String(state.expanded.has(key)));
      } else {
        row.removeAttribute('aria-expanded');
      }
      row.setAttribute('aria-busy', String(state.pending.has(key)));
    }
    const templateName = atomOf(state.el, 'template');
    const template = state.options.templates?.[templateName];
    if (row._item !== item || row._template !== templateName) {
      const content = template ? template(item, { document }) : label(item);
      row.replaceChildren(
        typeof content === 'string' ? document.createTextNode(content) : content
      );
      row._item = item;
      row._template = templateName;
    }
  }
}

export function refreshData(state) {
  const { kind, source, header, body, ctx } = state;
  const keyList = () => state.items.map(itemKey);
  if (state.disposed) {
    return;
  }
  const raw = itemsOf(source) ?? [];
  const collection = Array.isArray(raw) ? raw : [];
  state.columns = kind === 'table' ? columnsOf(state.el) : [];
  state.items =
    kind === 'tree'
      ? flattenTree(collection, state.expanded, state.loaded)
      : kind === 'table'
        ? sortItems(collection, state.sort ?? undefined)
        : collection;
  const keys = keyList();
  const present = new Set(keys);
  if (new Set(keys).size !== keys.length || keys.includes('undefined')) {
    ctx.diagnostic('invalid-items', 'error', { property: 'items' });
    state.items = []; // Stable, unique ids are required for focus and measurements.
  }
  if (!present.has(state.active)) {
    state.active = state.items.length ? itemKey(state.items[0]) : null;
  }
  state.selected = new Set(
    [...state.selected].filter((key) => present.has(key))
  );
  renderStatus(state);
  if (header) {
    header.render();
    header.header.style.gridTemplateColumns = state.trackSizes();
    state.root.setAttribute('aria-rowcount', state.items.length + 1);
    body.style.minWidth = `${state.columns.reduce((sum, c) => sum + (state.widths.get(c.name) ?? c.width), 0)}px`;
  }
}

function renderStatus(state) {
  const { root, node, status, caption, kind, mode } = state;
  const loading = flagOf(state.el, 'loading');
  const error = atomOf(state.el, 'error');
  const unavailable = loading || Boolean(error);
  state.viewport.setActive(state.active);
  state.viewport.setItems(unavailable ? [] : state.items);
  root.hidden = unavailable || !state.items.length;
  node.setAttribute('aria-busy', String(loading || state.pending.size > 0));
  root.setAttribute(
    'aria-label',
    atomOf(state.el, 'label') ?? atomOf(state.el, 'caption') ?? kind
  );
  root.setAttribute('role', roles[kind]);
  node.removeAttribute('role');
  root.setAttribute('aria-multiselectable', String(mode() === 'multi'));
  node.tabIndex = unavailable || !state.items.length ? 0 : -1;
  status.textContent = statusMessage(state, loading, error);
  caption.textContent =
    kind === 'table' ? (atomOf(state.el, 'caption') ?? 'Table') : '';
  caption.hidden = kind !== 'table';
}

function statusMessage(state, loading, error) {
  if (loading) {
    return 'Loading…';
  }
  if (error) {
    return `Error: ${error}`;
  }
  if (state.failures.size) {
    return `Error loading children: ${[...state.failures.values()].join('; ')}`;
  }
  if (state.pending.size) {
    return 'Loading children…';
  }
  return state.items.length ? '' : (atomOf(state.el, 'empty') ?? 'No items');
}
