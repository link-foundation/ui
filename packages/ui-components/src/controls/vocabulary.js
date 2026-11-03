/**
 * The vocabulary of the basic controls (kinds.lino), in the shape of
 * docs/spec/vocabulary.lino. Each kind entry also names the behaviour
 * machine of the control (`(machine NAME)`) and its ARIA role
 * (`(role NAME)`): these two are component metadata, not properties, so
 * they are read here and left out of the vocabulary.
 *
 * Parse control documents with `{ vocabulary: controlsVocabulary() }`.
 * The same kinds are declared in docs/spec/vocabulary.lino, so the default
 * vocabulary already knows them; tests/controls/vocabulary.test.js checks
 * that the two stay equal.
 */

import { defaultVocabulary, projectLinks } from '@link-foundation/ui-core';
import { Parser } from 'links-notation';
import { CONTROL_KINDS_TEXT } from './kinds-text.js';

export { CONTROL_KINDS_TEXT };

/** A bootstrap kind of the given property names (`*`: multi). */
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

/** kinds.lino is read as a document of `kind` elements with metadata. */
const BOOTSTRAP = Object.freeze({
  version: null,
  kinds: new Map([
    [
      'kind',
      kindSpec([
        'description',
        'positional',
        'property*',
        'children',
        'machine',
        'role',
      ]),
    ],
  ]),
  actions: new Map(),
  multiValued: new Set(),
});

const valuesOf = (element, name) =>
  element.properties.filter((p) => p.name === name).map((p) => p.values);

/** The single atom of a metadata field, or `null`. */
const fieldOf = (element, name) => {
  const [values] = valuesOf(element, name);
  return typeof values?.[0] === 'string' ? values[0] : null;
};

/** A kind entry as a vocabulary kind (as ui-core `loadVocabulary` reads it). */
function kindOf(element) {
  const [children = ['any']] = valuesOf(element, 'children');
  return {
    positional: valuesOf(element, 'positional').flat(),
    properties: new Map(
      valuesOf(element, 'property').map(([name, type, ...flags]) => [
        name,
        { type, multi: flags.includes('multi') },
      ])
    ),
    children: children[0],
  };
}

let cached = null;

/** Read kinds.lino once: the vocabulary kinds and the metadata by kind. */
function read() {
  if (cached !== null) {
    return cached;
  }
  const links = new Parser().parse(CONTROL_KINDS_TEXT);
  const { roots, diagnostics } = projectLinks(links, BOOTSTRAP);
  if (diagnostics.length > 0) {
    throw new Error(
      `Invalid control kinds: ${diagnostics.map((d) => d.message).join('; ')}`
    );
  }
  const meta = new Map();
  const kinds = new Map();
  for (const element of roots) {
    meta.set(
      element.id,
      Object.freeze({
        machine: fieldOf(element, 'machine'),
        role: fieldOf(element, 'role'),
      })
    );
    kinds.set(element.id, kindOf(element));
  }
  cached = { meta, kinds };
  return cached;
}

/** The control kind names, in kinds.lino order. */
export const controlKindNames = () => [...read().meta.keys()];

/**
 * The machine and the role of a control kind (`null` when it has none);
 * `undefined` for a kind that is not a control.
 * @param {string} kind
 * @returns {{machine: string|null, role: string|null}|undefined}
 */
export const controlKindMeta = (kind) => read().meta.get(kind);

/** The common properties of the dialect (`note`, `machine`). */
function withCommon(kinds, base) {
  const common = [...(base.kinds.get('document')?.properties ?? [])].filter(
    ([name]) => name === 'note' || name === 'machine'
  );
  for (const kind of kinds.values()) {
    for (const [name, spec] of common) {
      if (!kind.properties.has(name)) {
        kind.properties.set(name, spec);
      }
    }
  }
  return kinds;
}

let vocabulary = null;

/**
 * The ui-dialect vocabulary with the control kinds (cached).
 * @returns {import('@link-foundation/ui-core').Vocabulary}
 */
export function controlsVocabulary() {
  if (vocabulary === null) {
    const base = defaultVocabulary();
    vocabulary = Object.freeze({
      ...base,
      kinds: new Map([...base.kinds, ...withCommon(read().kinds, base)]),
    });
  }
  return vocabulary;
}
