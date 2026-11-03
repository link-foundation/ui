/**
 * The error of a chart spec that cannot be read, with the position of the
 * bad link so an author can find it.
 */

import { formatNode } from './lino.js';

/**
 * The position of a link: its index path in the unfolded tree of the
 * document (`[0, 3, 1]` is the second value of the fourth value of the
 * first top-level link) and its LiNo text.
 * @typedef {{ path: number[], link: string|null }} LinkPosition
 */

/**
 * A position of a node.
 * @param {number[]} path
 * @param {import('./lino.js').Node} [node]
 * @returns {LinkPosition}
 */
export const at = (path, node) => ({
  path: [...path],
  link: node === undefined ? null : formatNode(node),
});

/** The position as text: `link 1 > 4 > 2: (mark pie)` (1-based). */
export function describePosition({ path, link }) {
  const where =
    path.length === 0
      ? 'document'
      : `link ${path.map((i) => i + 1).join(' > ')}`;
  return link === null ? where : `${where}: ${link}`;
}

/** A chart spec that cannot be read. */
export class ChartSpecError extends Error {
  /**
   * @param {string} code  a stable machine-readable reason (`unknown-mark`)
   * @param {string} reason  the human-readable reason
   * @param {LinkPosition} position  where the bad link is
   */
  constructor(code, reason, position) {
    super(`${reason} (at ${describePosition(position)})`);
    this.name = 'ChartSpecError';
    this.code = code;
    this.reason = reason;
    this.path = position.path;
    this.link = position.link;
  }
}

/**
 * Throw a ChartSpecError at a node.
 * @param {string} code
 * @param {string} reason
 * @param {import('./lino.js').Node} node
 * @param {number[]} path
 * @returns {never}
 */
export function fail(code, reason, node, path) {
  throw new ChartSpecError(code, reason, at(path, node));
}
