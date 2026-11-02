/**
 * A2UI interop: agent message streams <-> incremental document diffs and
 * documents.
 */

export { importA2ui } from './import.js';
export { exportA2ui, normalizeA2ui } from './export.js';
export {
  A2uiStream,
  a2uiMessagesToDiffs,
  applyA2uiDiffs,
  diffTrees,
} from './diffs.js';
export { A2UI_VERSION, SUPPORTED_VERSIONS } from './shared.js';
