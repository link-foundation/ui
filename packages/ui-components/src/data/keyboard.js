import { numberOf } from '../layout/dom.js';
import { itemKey } from './source.js';

function horizontal(state, item, index, right) {
  if (state.kind === 'table') {
    state.cell = Math.max(
      0,
      Math.min(state.columns.length - 1, state.cell + (right ? 1 : -1))
    );
    return index;
  }
  if (state.kind !== 'tree') {
    return undefined;
  }
  const open = state.expanded.has(state.active);
  if (right && item._tree.branch && !open) {
    state.expand(item, true);
  } else if (
    right &&
    open &&
    state.items[index + 1]?._tree.level > item._tree.level
  ) {
    return index + 1;
  } else if (!right && open) {
    state.expand(item, false);
  } else if (!right && item._tree.parent !== null) {
    return state.items.findIndex((x) => itemKey(x) === item._tree.parent);
  }
  return undefined;
}

function endpoints(state, index, event, end) {
  const command = event.ctrlKey || event.metaKey;
  if (state.kind === 'table') {
    state.cell = end ? state.columns.length - 1 : 0;
    if (!command) {
      return index;
    }
  }
  return end ? state.items.length - 1 : 0;
}

function specialKey(state, item, index, event) {
  const command = event.ctrlKey || event.metaKey;
  if (event.key === 'Enter') {
    state.activate(event);
    if (state.kind === 'tree') {
      state.expand(item);
    }
    return { handled: true };
  }
  if (event.key === ' ') {
    state.select(item, event);
    return { handled: true };
  }
  if (event.key === '*' && state.kind === 'tree') {
    state.items
      .filter((x) => x._tree.parent === item._tree.parent && x._tree.branch)
      .forEach((x) => state.expand(x, true));
    return { handled: true };
  }
  if (event.key === 'a' && command && state.mode() === 'multi') {
    state.selected = new Set(state.items.map(itemKey));
    state.viewport.render();
    state.send('select', { item, selected: [...state.selected] });
    return { handled: true };
  }
  if (command || event.altKey || event.key.length !== 1) {
    return { handled: false };
  }
  return { handled: true, target: state.typeahead.handleKey(event.key, index) };
}

function keyTarget(state, item, index, event) {
  const page = () =>
    Math.max(
      1,
      Math.floor(
        state.root.clientHeight / numberOf(state.el, 'item-height', 32)
      )
    );
  const targets = {
    ArrowDown: () => index + 1,
    ArrowUp: () => index - 1,
    Home: () => endpoints(state, index, event, false),
    End: () => endpoints(state, index, event, true),
    PageDown: () => Math.min(state.items.length - 1, index + page()),
    PageUp: () => Math.max(0, index - page()),
    ArrowRight: () => horizontal(state, item, index, true),
    ArrowLeft: () => horizontal(state, item, index, false),
  };
  if (Object.hasOwn(targets, event.key)) {
    return { handled: true, target: targets[event.key]() };
  }
  return specialKey(state, item, index, event);
}

/** Grid headers participate in the same roving focus and arrow navigation. */
function headerKey(state, event) {
  const header = event.target.closest('[role=columnheader]');
  const cells = [...state.header.header.children];
  const at = cells.indexOf(header);
  const to = {
    ArrowLeft: at - 1,
    ArrowRight: at + 1,
    Home: 0,
    End: cells.length - 1,
  }[event.key];
  if (to !== undefined) {
    state.cell = Math.max(0, Math.min(cells.length - 1, to));
    cells[state.cell].firstChild.focus();
  } else if (event.key === 'ArrowDown' || event.key === 'PageDown') {
    state.focus(0);
  } else {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
}

function gridEndpoint(state, event) {
  if (
    state.kind !== 'table' ||
    !(event.ctrlKey || event.metaKey) ||
    !['Home', 'End'].includes(event.key)
  ) {
    return false;
  }
  const end = event.key === 'End';
  state.cell = end ? Math.max(0, state.columns.length - 1) : 0;
  if (end) {
    state.focus(state.items.length - 1);
  } else {
    state.header.header.firstChild?.firstChild.focus();
  }
  event.preventDefault();
  event.stopPropagation();
  return true;
}

function firstRowUp(state, index, event) {
  if (state.kind !== 'table' || index !== 0 || event.key !== 'ArrowUp') {
    return false;
  }
  event.preventDefault();
  state.header.header.children[state.cell]?.firstChild.focus();
  return true;
}

export function dataKeydown(state, event) {
  if (
    event.target.closest?.(
      'input,textarea,select,[contenteditable=true],.ui-data-resize'
    )
  ) {
    return;
  }
  if (gridEndpoint(state, event)) {
    return;
  }
  if (state.kind === 'table' && event.target.closest?.('.ui-data-header')) {
    return headerKey(state, event);
  }
  if (event.target.closest?.('button')) {
    return;
  }
  const index = state.items.findIndex((item) => itemKey(item) === state.active);
  if (index < 0) {
    return;
  }
  if (firstRowUp(state, index, event)) {
    return;
  }
  const result = keyTarget(state, state.items[index], index, event);
  if (!result.handled) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  if (result.target >= 0) {
    state.focus(result.target, event, selectOnMove(state, event));
  }
}

function selectOnMove(state, event) {
  return (
    state.kind !== 'table' && (state.mode() === 'single' || event.shiftKey)
  );
}
