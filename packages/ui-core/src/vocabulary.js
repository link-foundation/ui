/**
 * The vocabulary (docs/spec/vocabulary.lino): which kinds, properties and
 * actions the dialect declares. The vocabulary is itself a ui-dialect/0
 * document, so it is read with the same projection and a small bootstrap
 * vocabulary that knows only the kinds `kind`, `action` and `dialect`.
 */

import { Parser } from 'links-notation';
import { projectLinks } from './project.js';
import { VOCABULARY_TEXT } from './vocabulary-text.js';

/** Bootstrap kinds: property names, `*` marks a multi property. */
const BOOTSTRAP = {
  kind: ['description', 'positional', 'property*', 'children'],
  action: ['description', 'argument*'],
  dialect: ['version', 'multi-valued', 'reserved-sigil', 'reserved-property*'],
};

const kindSpec = (names) => ({
  positional: [],
  children: 'any',
  properties: new Map(
    names.map((name) => {
      const multi = name.endsWith('*');
      return [multi ? name.slice(0, -1) : name, { type: 'any', multi }];
    })
  ),
});

/** @type {import('./types.js').Vocabulary} */
const bootstrap = {
  version: null,
  kinds: new Map(
    Object.entries(BOOTSTRAP).map(([kind, names]) => [kind, kindSpec(names)])
  ),
  actions: new Map(),
  multiValued: new Set(),
};

const valuesOf = (element, name) =>
  element.properties.filter((p) => p.name === name).map((p) => p.values);

function readKind(element) {
  const properties = new Map();
  for (const [name, type, ...flags] of valuesOf(element, 'property')) {
    properties.set(name, { type, multi: flags.includes('multi') });
  }
  const [children = ['any']] = valuesOf(element, 'children');
  return {
    positional: valuesOf(element, 'positional').flat(),
    properties,
    children: children[0],
  };
}

/**
 * Read a vocabulary document.
 * @param {string} text Links Notation text in the shape of
 *   docs/spec/vocabulary.lino
 * @returns {import('./types.js').Vocabulary}
 * @throws {Error} when the text is not a valid vocabulary
 */
export function loadVocabulary(text) {
  const links = new Parser().parse(text);
  const { roots, diagnostics } = projectLinks(links, bootstrap);
  if (diagnostics.length > 0) {
    throw new Error(
      `Invalid vocabulary: ${diagnostics.map((d) => d.message).join('; ')}`
    );
  }
  /** @type {import('./types.js').Vocabulary} */
  const vocabulary = {
    version: null,
    kinds: new Map(),
    actions: new Map(),
    multiValued: new Set(),
  };
  for (const element of roots) {
    if (element.kind === 'kind') {
      vocabulary.kinds.set(element.id, readKind(element));
    } else if (element.kind === 'action') {
      vocabulary.actions.set(element.id, valuesOf(element, 'argument'));
    } else if (element.kind === 'dialect') {
      const [[version] = [null]] = valuesOf(element, 'version');
      vocabulary.version = version;
      for (const name of valuesOf(element, 'multi-valued').flat()) {
        vocabulary.multiValued.add(name);
      }
    }
  }
  return vocabulary;
}

let cached = null;

/**
 * The ui-dialect/0 vocabulary, read once on first use.
 * @returns {import('./types.js').Vocabulary}
 */
export function defaultVocabulary() {
  cached ??= loadVocabulary(VOCABULARY_TEXT);
  return cached;
}
