/**
 * Component mappings of the JSX and Vue importers: the rule files
 * (`<name>.lino`, read by `rules.js`) and the vocabulary of imported
 * component documents.
 */

import { loadVocabulary } from '@link-foundation/ui-core';
import { readSibling, mergeVocabulary } from '../interop/vocabulary.js';
import { htmlVocabulary } from '../html/vocabulary.js';
import { readRules } from '../rules.js';

/** The names of the built-in rule files. */
export const MAPPINGS = Object.freeze(['mui']);

/** The text of the component vocabulary extension (Links Notation). */
export const COMPONENT_VOCABULARY_TEXT = readSibling(
  import.meta.url,
  './vocabulary.lino'
);

let vocabulary = null;

/**
 * The vocabulary of documents imported from JSX and Vue: the HTML import
 * vocabulary plus the component kinds the rule files map to, the `action`
 * action of event handlers and the properties every imported element may
 * have (`tag`, `attr`, `style`, `unsupported`, `on`, `when`, `each`,
 * `bind`). Pass it to `parse` from `@link-foundation/ui-core` to read an
 * import result without diagnostics.
 * @returns {import('@link-foundation/ui-core').Vocabulary}
 */
export function componentVocabulary() {
  vocabulary ??= mergeVocabulary(
    htmlVocabulary(),
    loadVocabulary(COMPONENT_VOCABULARY_TEXT)
  );
  return vocabulary;
}

const cache = new Map();

/**
 * The rules of a built-in mapping (`'mui'`), cached after the first read.
 * @param {string} name
 * @returns {import('../rules.js').Rule[]}
 */
export function mappingRules(name) {
  if (!MAPPINGS.includes(name)) {
    throw new Error(
      `Unknown mapping "${name}" (known: ${MAPPINGS.join(', ')})`
    );
  }
  if (!cache.has(name)) {
    cache.set(name, readRules(readSibling(import.meta.url, `./${name}.lino`)));
  }
  return cache.get(name);
}

/**
 * The rules of a list of mappings: built-in names or rule file texts
 * (Links Notation with `(name: rule (match ...) (replace ...))` links),
 * in order, so the first mapping wins.
 * @param {string[]} mappings
 */
export const loadMappings = (mappings) =>
  mappings.flatMap((mapping) =>
    mapping.includes('(') ? readRules(mapping) : mappingRules(mapping)
  );
