/**
 * Plain English descriptions of configuration changes, for people and AI
 * agents (R12).
 */

import { EDITABLE_LAYERS, layerIndex, overrideKey } from './layers.js';
import { describeValues, valuesEqual } from './values.js';

/**
 * One line per override of `layers` that changes the value resolved below
 * them, for example
 * `greeting: text changed from 'Hello, links' (site) to 'Hello, agents' (user)`.
 * @param {ReturnType<typeof import('./config.js').createConfig>} config
 * @param {readonly import('./layers.js').Layer[]} [layers]
 * @returns {string[]}
 */
export function describeChanges(config, layers = EDITABLE_LAYERS) {
  const sorted = [...layers].sort((a, b) => layerIndex(a) - layerIndex(b));
  if (sorted.length === 0) {
    return [];
  }
  const lowest = layerIndex(sorted[0]);
  const lines = [];
  const seen = new Set();
  for (const layer of sorted) {
    for (const t of config.overrides(layer)) {
      const k = overrideKey(t.id, t.name, t.key);
      if (seen.has(k)) {
        continue;
      }
      seen.add(k);
      const all = config.explain(t.id, t.name, t.key ?? undefined);
      const after = all.filter((e) => sorted.includes(e.layer)).at(-1);
      const before = all.filter((e) => layerIndex(e.layer) < lowest).at(-1);
      const what = `${t.id}: ${t.key === null ? t.name : `${t.name} ${t.key}`}`;
      const to = `${describeValues(after.value)} (${after.layer})`;
      if (!before) {
        lines.push(`${what} set to ${to}`);
      } else if (!valuesEqual(before.value, after.value)) {
        lines.push(
          `${what} changed from ${describeValues(before.value)} (${before.layer}) to ${to}`
        );
      }
    }
  }
  return lines;
}
