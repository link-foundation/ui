/**
 * `@link-foundation/ui-convert`: converters between other UI formats and
 * the UI dialect of Links Notation: the HTML/DOM importer, the JSX and Vue
 * component importers with LiNo mapping rules (MUI), and the A2UI,
 * Adaptive Cards, JSON Forms and Lottie interop.
 */

export { importHtml, importDom, mapHtmlElement } from './html/import.js';
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

export { importJsx } from './jsx/import.js';
export { parseJsx, cleanJsxText } from './jsx/parse.js';
export { importVue } from './vue/import.js';
export { parseVue } from './vue/parse.js';
export { importComponents } from './components/import.js';
export {
  literalText,
  pathText,
  styleDeclarations,
  cssName,
} from './components/expression.js';
export { eventName, jsxEvent } from './components/events.js';
export {
  readRules,
  matchTerm,
  matchElement,
  substitute,
  applyRules,
} from './rules.js';
export {
  MAPPINGS,
  COMPONENT_VOCABULARY_TEXT,
  componentVocabulary,
  mappingRules,
  loadMappings,
} from './mappings/index.js';

export { Diagnostics } from './diagnostics.js';
export * from './interop/index.js';

export { exportDocument, TARGETS } from './export/index.js';
export { collectActions } from './export/actions.js';
