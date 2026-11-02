/**
 * `@link-foundation/ui-convert`: converters between other UI formats and
 * the UI dialect of Links Notation. This release has the HTML/DOM importer.
 */

export { importHtml, importDom } from './html/import.js';
export {
  HTML_MAPPING,
  HTML_FALLBACK_KIND,
  findRule,
  ruleMatches,
} from './html/mapping.js';
export { assignIds, isValidId } from './html/ids.js';
export { parseStyle, styleLink, collapseCss } from './html/style.js';
export {
  DROPPED_TAGS,
  SCRIPT_SCHEMES,
  hasScriptUrl,
  isEventAttribute,
} from './html/security.js';
export {
  HTML_VOCABULARY_TEXT,
  htmlVocabulary,
  extendVocabulary,
} from './html/vocabulary.js';
export { readHtml } from './html/from-html.js';
export { readDom } from './html/from-dom.js';
