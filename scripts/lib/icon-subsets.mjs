/** Read app-selected icon references with the official nested LiNo parser. */
import { readFileSync } from 'node:fs';
import { parseNested, valueJson } from '../../packages/ui-core/src/links.js';
import { isIconName } from '../../packages/ui-components/src/icons/adapters/shared.js';

/** `icons` followed by one indented SET:NAME per line. */
export function readIconSubset(file, sets) {
  const roots = parseNested(readFileSync(file, 'utf8')).map(valueJson);
  if (
    roots.length !== 1 ||
    !Array.isArray(roots[0]) ||
    roots[0][0] !== 'icons' ||
    roots[0].length < 2
  ) {
    throw new Error(
      'icon names: expected icons with indented SET:NAME references'
    );
  }
  const selected = new Map();
  for (const child of roots[0].slice(1)) {
    const ref = Array.isArray(child) && child.length === 1 ? child[0] : child;
    if (typeof ref !== 'string') {
      throw new Error('icon names: expected SET:NAME');
    }
    const [set, name, extra] = ref.split(':');
    if (!isIconName(set) || !isIconName(name) || extra !== undefined) {
      throw new Error(`icon names: invalid reference ${ref}`);
    }
    if (!selected.has(set)) {
      selected.set(set, new Set());
    }
    selected.get(set).add(name);
  }
  if (sets) {
    const excluded = [...selected.keys()].filter((set) => !sets.includes(set));
    if (excluded.length) {
      throw new Error(`--sets excludes requested sets: ${excluded.join(', ')}`);
    }
  }
  return selected;
}
