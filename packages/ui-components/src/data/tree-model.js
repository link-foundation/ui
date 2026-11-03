import { itemKey } from './source.js';

/** Iterative preorder projection: large/deep trees need no recursive DOM. */
export function flattenTree(items, expanded, loaded = new Map()) {
  const visible = [];
  const stack = items
    .map((item, i) => ({
      item,
      level: 1,
      parent: null,
      position: i + 1,
      size: items.length,
    }))
    .reverse();
  while (stack.length) {
    const entry = stack.pop();
    const { item, level } = entry;
    const key = itemKey(item);
    const children = loaded.get(key) ?? item.children ?? [];
    visible.push({
      ...item,
      _tree: {
        ...entry,
        item: undefined,
        branch: item.hasChildren === true || children.length > 0,
      },
    });
    if (expanded.has(key)) {
      for (let i = children.length - 1; i >= 0; i--) {
        stack.push({
          item: children[i],
          level: level + 1,
          parent: key,
          position: i + 1,
          size: children.length,
        });
      }
    }
  }
  return visible;
}
