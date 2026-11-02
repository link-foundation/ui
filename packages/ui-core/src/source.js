/**
 * `@link-foundation/ui-core/source`: source-preserving edits of LiNo text.
 *
 * A stopgap until `links-notation` reports source positions: then
 * `source/index.js` reads them from the parser and `source/scan.js` goes.
 */

export { scanDelimiters, quotedEnd } from './source/scan.js';
export {
  indexSource,
  findElement,
  normalizeLink,
  SourceIndexError,
} from './source/index.js';
export {
  setProp,
  removeProp,
  setPositional,
  insertChild,
  removeNode,
  moveNode,
  renameId,
  applyEdits,
  checkEdit,
  SourceEditError,
} from './source/edit.js';
export { applyOpsToSource } from './source/apply.js';
export { applyOpToTree, OP_NAMES } from './source/ops.js';
