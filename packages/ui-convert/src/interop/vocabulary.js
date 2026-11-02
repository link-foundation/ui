/**
 * The interop vocabulary: the ui-dialect/0 vocabulary of ui-core extended by
 * `vocabulary.lino` with the kinds, properties and actions the four
 * interop formats need. The pseudo kind `common` lists properties every kind
 * accepts (`extra`, `spacing`, ...) and the pseudo kind `field` lists the
 * properties of every form field kind. The kinds in `CONTAINER_KINDS` may
 * hold children.
 *
 * The extension is merged into new maps; the cached ui-core vocabulary is
 * never changed.
 */

import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { defaultVocabulary, loadVocabulary } from '@link-foundation/ui-core';

/** Read a `.lino` file that sits next to a module. */
export const readSibling = (moduleUrl, name) =>
  readFileSync(new URL(name, moduleUrl), 'utf8');

/** Pseudo kinds: property sets merged into other kinds, never kinds. */
const PSEUDO_KINDS = ['common', 'field'];

/** The form field kinds; each accepts the properties of `field`. */
export const FIELD_KINDS = [
  'text-field',
  'number-field',
  'date-field',
  'time-field',
  'checkbox',
  'select',
  'slider',
];

/**
 * Base kinds that hold children in interop documents (an A2UI Button holds
 * a child component, usually a Text).
 */
export const CONTAINER_KINDS = ['button'];

const copyKind = (spec) => ({ ...spec, properties: new Map(spec.properties) });

/**
 * Merge an extension vocabulary into a copy of a base vocabulary.
 * @param {import('@link-foundation/ui-core').Vocabulary} base
 * @param {import('@link-foundation/ui-core').Vocabulary} extension
 */
export function mergeVocabulary(base, extension) {
  const kinds = new Map(
    [...base.kinds].map(([name, spec]) => [name, copyKind(spec)])
  );
  for (const [name, spec] of extension.kinds) {
    if (PSEUDO_KINDS.includes(name)) {
      continue;
    }
    const kind = kinds.get(name);
    if (kind) {
      for (const [property, type] of spec.properties) {
        kind.properties.set(property, type);
      }
    } else {
      kinds.set(name, copyKind(spec));
    }
  }
  const shared = (name, targets) => {
    const properties = extension.kinds.get(name)?.properties ?? new Map();
    for (const target of targets) {
      const kind = kinds.get(target);
      for (const [property, type] of properties) {
        if (kind && !kind.properties.has(property)) {
          kind.properties.set(property, type);
        }
      }
    }
  };
  for (const name of CONTAINER_KINDS) {
    if (kinds.has(name)) {
      kinds.set(name, { ...kinds.get(name), children: 'any' });
    }
  }
  shared('field', FIELD_KINDS);
  shared('common', [...kinds.keys()]);
  return {
    version: base.version,
    kinds,
    actions: new Map([...base.actions, ...extension.actions]),
    multiValued: new Set([...base.multiValued, ...extension.multiValued]),
  };
}

let cached = null;

/**
 * The interop vocabulary, built lazily and cached. Do not change it.
 * @returns {import('@link-foundation/ui-core').Vocabulary}
 */
export function interopVocabulary() {
  cached ??= mergeVocabulary(
    defaultVocabulary(),
    loadVocabulary(readSibling(import.meta.url, './vocabulary.lino'))
  );
  return cached;
}
