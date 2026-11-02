/**
 * What the Adaptive Cards importer and exporter share.
 */

import { loadMapping } from '../mapping.js';

/** The format name used in `(source ...)`, `(extra ...)` and diagnostics. */
export const FORMAT = 'adaptive-cards';

/** The newest Adaptive Cards version the mapping knows. */
export const ADAPTIVE_CARDS_VERSION = '1.6';

/** The mapping table (mapping.lino). */
export const mapping = loadMapping(import.meta.url);

/**
 * Compare two `major.minor` versions.
 * @param {string} a
 * @param {string} b
 * @returns {number} negative, zero or positive
 */
export function compareVersions(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) {
      return d;
    }
  }
  return 0;
}
