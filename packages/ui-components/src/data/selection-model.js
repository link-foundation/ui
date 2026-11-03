/** Immutable selection state. Keys are stable strings, ordered by the visible collection. */
export function selectItem({
  keys,
  selected = new Set(),
  anchor = null,
  key,
  mode = 'single',
  shift = false,
  toggle = false,
}) {
  if (!keys.includes(key) || mode === 'none') {
    return { selected: new Set(selected), anchor };
  }
  if (mode === 'single') {
    return singleSelection(selected, key, toggle);
  }
  if (shift && keys.includes(anchor)) {
    return rangeSelection(keys, selected, anchor, key, toggle);
  }
  const next = toggle ? new Set(selected) : new Set();
  if (toggle && next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }
  return { selected: next, anchor: key };
}

function singleSelection(selected, key, toggle) {
  return {
    selected: new Set(toggle && selected.has(key) ? [] : [key]),
    anchor: key,
  };
}
function rangeSelection(keys, selected, anchor, key, toggle) {
  const a = keys.indexOf(anchor);
  const b = keys.indexOf(key);
  const range = keys.slice(Math.min(a, b), Math.max(a, b) + 1);
  return {
    selected: new Set(toggle ? [...selected, ...range] : range),
    anchor,
  };
}
