/**
 * A2UI messages -> ui-dialect documents: the diffs of the whole stream
 * applied to an empty tree. Every surface still open at the end of the
 * stream is one `document`.
 */

import { writeLino } from '../lino.js';
import { a2uiMessagesToDiffs, applyA2uiDiffs } from './diffs.js';

/**
 * Import an A2UI message stream.
 * @param {object[]|{ messages: object[] }|string} messages Messages in
 *   stream order (an array, a `{ messages }` sample or JSON Lines text).
 * @param {{ style?: 'inline'|'multiline'|'indented' }} [options]
 * @returns {{ lino: string, roots: object[],
 *   diagnostics: import('../../diagnostics.js').Diagnostic[] }}
 */
export function importA2ui(messages, options = {}) {
  const { diffs, diagnostics } = a2uiMessagesToDiffs(messages);
  const roots = applyA2uiDiffs([], diffs);
  return { lino: writeLino(roots, options), roots, diagnostics };
}
