/**
 * The vocabulary (docs/spec/vocabulary.lino): which kinds, properties and
 * actions the dialect declares. The vocabulary is itself a ui-dialect/0
 * document, so it is read with the same projection and a small bootstrap
 * vocabulary that knows only the kinds `kind`, `action` and `dialect`.
 */

import { parseNested } from './links.js';
import { projectLinks } from './project.js';
import { VOCABULARY_TEXT } from './vocabulary-text.js';

/** Bootstrap kinds: property names, `*` marks a multi property. */
const BOOTSTRAP = {
  kind: ['description', 'positional', 'property*', 'children'],
  action: ['description', 'argument*'],
  dialect: [
    'version',
    'multi-valued',
    'reserved-sigil',
    'reserved-property*',
    'common-property*',
  ],
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

/** `(property name type flags...)` values as `[name, { type, multi }]`. */
const propertyEntries = (element, property) =>
  valuesOf(element, property).map(([name, type, ...flags]) => [
    name,
    { type, multi: flags.includes('multi') },
  ]);

function readKind(element) {
  const properties = new Map(propertyEntries(element, 'property'));
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
  const links = parseNested(text);
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
  const common = [];
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
      common.push(...propertyEntries(element, 'common-property'));
    }
  }
  // A common property (such as `note`) is declared on every kind.
  for (const kind of vocabulary.kinds.values()) {
    for (const [name, spec] of common) {
      if (!kind.properties.has(name)) {
        kind.properties.set(name, spec);
      }
    }
  }
  return vocabulary;
}

let cached = null;

/**
 * The ui-dialect/0 vocabulary, built lazily and cached.
 * @returns {import('./types.js').Vocabulary}
 */
export function defaultVocabulary() {
  cached ??= loadVocabulary(VOCABULARY_TEXT);
  return cached;
}
