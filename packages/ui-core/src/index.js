/**
 * `@link-foundation/ui-core`: the core of the associative UI framework.
 *
 * It reads the UI dialect of Links Notation (docs/spec/) into a plain JSON
 * element tree and writes it back. Text is read only by the official
 * `links-notation` parser; this package projects the links it returns.
 */

import { SPEC_VERSION } from './parse.js';

/**
 * Version identifier of the UI dialect of Links Notation understood by this
 * package.
 * @type {string}
 */
export const UI_DIALECT_VERSION = SPEC_VERSION;

export {
  parse,
  parseOrThrow,
  toTree,
  parseLinks,
  UiParseError,
  SPEC_VERSION,
  DEFAULT_MAX_DEPTH,
  DEFAULT_MAX_INPUT_SIZE,
} from './parse.js';
export { format, formatLinks, elementLink } from './format.js';
export { walk } from './walk.js';
export { projectLink, projectLinks } from './project.js';
export { loadVocabulary, defaultVocabulary } from './vocabulary.js';
export { valueMatches } from './check.js';
