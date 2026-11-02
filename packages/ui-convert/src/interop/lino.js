/**
 * Building and reading UI-dialect element trees.
 *
 * Importers build plain ui-core nodes and write them with ui-core `format`
 * (which writes every link with `links-notation`). Exporters read text with
 * ui-core `parse` and the interop vocabulary. No LiNo text is ever read or
 * written by hand.
 */

import { format, parse } from '@link-foundation/ui-core';
import { interopVocabulary } from './vocabulary.js';

/**
 * @typedef {import('@link-foundation/ui-core').UiNode} UiNode
 * @typedef {import('@link-foundation/ui-core').RawValue} RawValue
 * @typedef {{ name: string, values: RawValue[] }} UiProperty
 */

/**
 * A property, or `null` when `values` has an `undefined` (so builders can
 * write optional properties inline and filter them out).
 * @param {string} name
 * @param {...RawValue} values
 * @returns {UiProperty|null}
 */
export const prop = (name, ...values) =>
  values.some((v) => v === undefined) ? null : { name, values };

/**
 * A ui-core node.
 * @param {string|null} id
 * @param {string} kind
 * @param {{ positional?: string[], properties?: (UiProperty|null)[],
 *   children?: UiNode[] }} [parts]
 * @returns {UiNode}
 */
export function element(id, kind, parts = {}) {
  return {
    id,
    kind,
    positional: parts.positional ?? [],
    properties: (parts.properties ?? []).filter(Boolean),
    children: parts.children ?? [],
    unknown: [],
  };
}

/**
 * Write element trees as LiNo text.
 * @param {UiNode[]} roots
 * @param {{ style?: 'inline'|'multiline'|'indented' }} [options]
 */
export const writeLino = (roots, options = {}) =>
  format({ roots, unknown: [] }, { style: options.style ?? 'indented' });

/**
 * Read LiNo text (or an already parsed document) with the interop
 * vocabulary. Parser diagnostics are returned with the tree.
 * @param {string|{ roots: UiNode[] }} input
 */
export function readLino(input) {
  if (typeof input !== 'string') {
    return { roots: input.roots, diagnostics: input.diagnostics ?? [] };
  }
  const doc = parse(input, { vocabulary: interopVocabulary() });
  return { roots: doc.roots, diagnostics: doc.diagnostics };
}

/**
 * Every property of a node, including sublinks the vocabulary does not
 * declare (kept by ui-core in `unknown` as `[name, ...values]`).
 * @param {UiNode} node
 * @returns {UiProperty[]}
 */
export function propertiesOf(node) {
  const undeclared = node.unknown
    .filter((v) => Array.isArray(v) && typeof v[0] === 'string')
    .map(([name, ...values]) => ({ name, values }));
  return [...node.properties, ...undeclared];
}

/**
 * The values of the last property called `name`, or `undefined`.
 * @param {UiNode} node
 * @param {string} name
 * @returns {RawValue[]|undefined}
 */
export function values(node, name) {
  const found = propertiesOf(node).filter((p) => p.name === name);
  return found.length > 0 ? found[found.length - 1].values : undefined;
}

/**
 * The first value of the property called `name`, or `undefined`.
 * @param {UiNode} node
 * @param {string} name
 */
export const value = (node, name) => values(node, name)?.[0];

/**
 * All occurrences of a multi-valued property.
 * @param {UiNode} node
 * @param {string} name
 * @returns {RawValue[][]}
 */
export const allValues = (node, name) =>
  propertiesOf(node)
    .filter((p) => p.name === name)
    .map((p) => p.values);

/**
 * Allocates unique element ids. A source id is kept when it is free;
 * otherwise a fresh id is made from a readable base.
 */
export class IdAllocator {
  /** @param {Iterable<string>} [reserved] */
  constructor(reserved = []) {
    this.used = new Set(reserved);
  }

  /**
   * Use `id` when it is a free, non-empty string; otherwise `null`.
   * @param {unknown} id
   */
  claim(id) {
    if (typeof id !== 'string' || id === '' || this.used.has(id)) {
      return null;
    }
    this.used.add(id);
    return id;
  }

  /**
   * A fresh id from `base`: `base`, `base-2`, `base-3`...
   * @param {string} base
   */
  fresh(base) {
    const stem = slug(base) || 'element';
    let id = stem;
    for (let n = 2; this.used.has(id); n++) {
      id = `${stem}-${n}`;
    }
    this.used.add(id);
    return id;
  }
}

const isSlugChar = (c) =>
  (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c === '-';

/**
 * Lowercase letters, digits and single dashes.
 * @param {string} text
 */
export function slug(text) {
  let out = '';
  for (const c of String(text).toLowerCase()) {
    const next = isSlugChar(c) ? c : '-';
    if (!(next === '-' && (out === '' || out.endsWith('-')))) {
      out += next;
    }
  }
  return out.endsWith('-') ? out.slice(0, -1) : out;
}
