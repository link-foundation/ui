import { selectItem } from './selection-model.js';
import { itemKey } from './source.js';
export function selectData(state, item, event = {}) {
  const { viewport, mode } = state;
  const keyList = () => state.items.map(itemKey);
  const next = selectItem({
    keys: keyList(),
    selected: state.selected,
    anchor: state.anchor,
    key: itemKey(item),
    mode: mode(),
    shift: event.shiftKey,
    toggle: event.ctrlKey || event.metaKey || event.key === ' ',
  });
  state.selected = next.selected;
  state.anchor = next.anchor;
  viewport.render();
  state.send('select', { item, selected: [...state.selected] });
}
export function focusData(state, index, event = {}, selectOnMove = false) {
  const { viewport, kind } = state;
  const item =
    state.items[Math.max(0, Math.min(index, state.items.length - 1))];
  if (!item) {
    return;
  }
  state.inHeader = false;
  state.active = itemKey(item);
  viewport.setActive(state.active);
  viewport.scrollTo(state.items.indexOf(item));
  viewport.render();
  const row = viewport.row(state.active);
  (kind === 'table' ? row?.children[state.cell] : row)?.focus({
    preventScroll: true,
  });
  if (selectOnMove && !event.ctrlKey && !event.metaKey) {
    state.select(item, event);
  }
}
