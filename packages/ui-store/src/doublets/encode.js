/**
 * A UI document as doublets: every link is a triple `(index, source,
 * target)` of positive integers, as in a doublets store (index 0 is
 * reserved).
 *
 * - Every distinct reference string (`ok`, `button`, `label`, `OK`) is a
 *   **point** `(i, i, i)`; `names` maps the string to `i`.
 * - Every other link is a **pair** `(i, source, target)`. Identical pairs are
 *   created once and reused (deduplicated), so no two triples share
 *   `(source, target)` except the points.
 * - A sequence `(a b c)` is folded to the left, starting from the empty list
 *   `nil`: `p1 = (p1, nil, a)`, `p2 = (p2, p1, b)`, `p3 = (p3, p2, c)`.
 *   `nil` is the pair of the points `list` and `end`. Because the left side
 *   of a fold is never a point, no pair of a point with itself, which would
 *   be the point, is ever needed.
 * - An element `ok: button ...` is the pair (point `ok`, body); an anonymous
 *   element is its body alone. The body is the sequence
 *   `(kind positional properties children unknown)` of five sequences
 *   (`kind` has zero or one value).
 * - A property `(label 'OK')` is the pair (point `label`, values).
 * - A raw value is a point (a string), the pair (`nil`, items) (a link
 *   without an id) or the pair (point id, values) (a link with an id).
 *
 * `roots` holds two links: the sequence of the root elements and the
 * sequence of the top-level links that are not elements.
 *
 * Decoding reads this structure only: the strings `list` and `end` may also
 * appear in the document.
 */

import { SPEC_VERSION } from '@link-foundation/ui-core';
import { check } from '../errors.js';

/** @typedef {import('@link-foundation/ui-core').UiDocument} UiDocument */
/** @typedef {import('@link-foundation/ui-core').UiNode} UiNode */
/** @typedef {import('@link-foundation/ui-core').RawValue} RawValue */
/** @typedef {{ index: number, source: number, target: number }} Doublet */
/**
 * @typedef {object} EncodedDocument
 * @property {Doublet[]} links           ordered by index, starting at 1
 * @property {Map<string, number>} names  reference string → its point
 * @property {number[]} roots            [root elements, top-level unknown]
 */

/** The strings of the two points of the empty list `nil`. */
export const NIL_POINTS = Object.freeze(['list', 'end']);

/** A builder of deduplicated doublets. */
function createBuilder() {
  /** @type {Doublet[]} */
  const links = [];
  const names = new Map();
  const pairs = new Map();
  const add = (source, target) => {
    const index = links.length + 1;
    const link = Object.freeze({
      index,
      source: source ?? index,
      target: target ?? index,
    });
    links.push(link);
    return index;
  };
  const point = (name) => {
    if (!names.has(name)) {
      names.set(name, add());
    }
    return names.get(name);
  };
  const pair = (source, target) => {
    const key = `${source} ${target}`;
    if (!pairs.has(key)) {
      pairs.set(key, add(source, target));
    }
    return pairs.get(key);
  };
  const nil = pair(point(NIL_POINTS[0]), point(NIL_POINTS[1]));
  /** A sequence: the left fold of `items` (already links) from `nil`. */
  const sequence = (items) => items.reduce(pair, nil);
  return { links, names, point, pair, nil, sequence };
}

/**
 * Encode a document (from `parse`, `store.toDocument()` or `{ roots,
 * unknown }`) as doublets.
 * @param {Pick<UiDocument, 'roots' | 'unknown'>} doc
 * @returns {EncodedDocument}
 */
export function encodeDocument(doc) {
  const { links, names, point, pair, nil, sequence } = createBuilder();
  /** @param {RawValue} value */
  const value = (value) => {
    if (typeof value === 'string') {
      return point(value);
    }
    if (Array.isArray(value)) {
      return pair(nil, values(value));
    }
    check(
      value !== null && typeof value === 'object',
      'bad-value',
      'A raw value is a string, an array or { id, values }'
    );
    return pair(point(value.id), values(value.values));
  };
  const values = (list = []) => sequence(list.map(value));
  /** @param {UiNode} node */
  const element = (node) => {
    const body = sequence([
      values(node.kind === null || node.kind === undefined ? [] : [node.kind]),
      values(node.positional),
      sequence(
        (node.properties ?? []).map((p) =>
          pair(point(p.name), values(p.values))
        )
      ),
      sequence((node.children ?? []).map(element)),
      values(node.unknown),
    ]);
    return node.id === null || node.id === undefined
      ? body
      : pair(point(node.id), body);
  };
  const roots = [
    sequence((doc.roots ?? []).map(element)),
    values(doc.unknown ?? []),
  ];
  return { links, names, roots };
}

/**
 * Read doublets written by {@link encodeDocument}. Throws a `StoreError`
 * with the code `bad-doublets` when they are not in that form.
 * @param {{ links: Iterable<Doublet>, names: Map<string, number> | Iterable<[string, number]>, roots: number[] }} encoded
 * @returns {UiDocument}
 */
export function decodeDocument({ links, names: givenNames, roots }) {
  const names = new Map(givenNames);
  const bad = (condition, message) => check(condition, 'bad-doublets', message);
  /** @type {Map<number, Doublet>} */
  const byIndex = new Map();
  for (const link of links) {
    const { index, source, target } = link;
    bad(
      [index, source, target].every((n) => Number.isSafeInteger(n) && n >= 1),
      `Link ${JSON.stringify(link)} is not three integers ≥ 1`
    );
    bad(!byIndex.has(index), `Link ${index} is given twice`);
    byIndex.set(index, link);
  }
  /** point index → its string */
  const strings = new Map();
  for (const [name, index] of names) {
    const link = byIndex.get(index);
    bad(
      link && link.source === index && link.target === index,
      `The name ${JSON.stringify(name)} is not a point`
    );
    bad(!strings.has(index), `Point ${index} has two names`);
    strings.set(index, name);
  }
  const get = (index) => {
    const link = byIndex.get(index);
    bad(link, `Link ${index} does not exist`);
    return link;
  };
  const isPoint = (index) => strings.has(index);
  /** A pair; its parts come before it, so there is no cycle. */
  const pairOf = (index, what) => {
    const link = get(index);
    bad(!isPoint(index), `${what} must be a pair, not point ${index}`);
    bad(
      link.source < index && link.target < index,
      `Pair ${index} must refer to earlier links`
    );
    return link;
  };
  const string = (index, what) => {
    bad(isPoint(index), `${what} must be a point, not link ${index}`);
    return strings.get(index);
  };
  const nilIndex = (() => {
    const [list, end] = NIL_POINTS.map((name) => names.get(name));
    for (const link of byIndex.values()) {
      if (link.source === list && link.target === end && !isPoint(link.index)) {
        return link.index;
      }
    }
    return undefined;
  })();
  const isNil = (index) => nilIndex !== undefined && index === nilIndex;
  /** The items of a sequence, first to last. */
  const sequence = (index, what) => {
    const items = [];
    let at = index;
    while (!isNil(at)) {
      const link = pairOf(at, what);
      items.push(link.target);
      at = link.source;
    }
    return items.reverse();
  };
  /** @returns {RawValue} */
  const value = (index) => {
    if (isPoint(index)) {
      return strings.get(index);
    }
    const link = pairOf(index, 'A value');
    if (isNil(link.source)) {
      return values(link.target);
    }
    return {
      id: string(link.source, 'A link id'),
      values: values(link.target),
    };
  };
  const values = (index) => sequence(index, 'A list of values').map(value);
  /** @returns {UiNode} */
  const element = (index) => {
    const link = pairOf(index, 'An element');
    const named = isPoint(link.source);
    const parts = sequence(named ? link.target : index, 'An element body');
    bad(parts.length === 5, `Element ${index} needs five parts`);
    const [kind, positional, properties, children, unknown] = parts;
    const kinds = values(kind);
    bad(kinds.length <= 1, `Element ${index} has more than one kind`);
    return {
      id: named ? strings.get(link.source) : null,
      kind: kinds.length === 0 ? null : kinds[0],
      positional: values(positional),
      properties: sequence(properties, 'Properties').map((p) => {
        const property = pairOf(p, 'A property');
        return {
          name: string(property.source, 'A property name'),
          values: values(property.target),
        };
      }),
      children: sequence(children, 'Children').map(element),
      unknown: values(unknown),
    };
  };
  bad(
    Array.isArray(roots) && roots.length === 2,
    'roots must be [elements, unknown]'
  );
  bad(nilIndex !== undefined, 'The empty list (list end) is missing');
  const rootNodes = sequence(roots[0], 'The root elements').map(element);
  const byId = new Map();
  const index = (node) => {
    if (node.id !== null && !byId.has(node.id)) {
      byId.set(node.id, node);
    }
    node.children.forEach(index);
  };
  rootNodes.forEach(index);
  return {
    spec: SPEC_VERSION,
    roots: rootNodes,
    unknown: values(roots[1]),
    byId,
    diagnostics: [],
  };
}
