/**
 * The export bundle of a persistent store: one Links Notation document.
 *
 * ```lino
 * (ui_store_bundle (schema 1) (name demo) (snapshot_tx 12))
 * (document (ok: button (label OK)))
 * (ids ok _2)
 * (tx 13 (origin devmode) (setProp ok label Cancel))
 * ```
 *
 * `document` is the snapshot at transaction `snapshot_tx`; the `tx` links
 * (the operation log format of `logToLino`) are the transactions after it.
 * When that text would be read back as a different document (a store
 * accepts properties that the vocabulary of ui-core does not know), the
 * exact `(document_tree ...)` of `bundle-tree.js` follows it and is used
 * instead.
 * `(ids ...)` is optional: the store IDs of every element of the snapshot in
 * pre-order, written when an anonymous element has an ID that a new store
 * would not generate for it (the `tx` links refer to elements by store ID).
 *
 * Text is read with `parseLinks` / `parseOrThrow` of ui-core and written
 * with `format` / `formatLinks`; the limits on size and depth are the ones
 * of `parseLinks`.
 */

import {
  DEFAULT_MAX_DEPTH,
  DEFAULT_MAX_INPUT_SIZE,
  format,
  formatLinks,
  parseLinks,
  parseOrThrow,
} from '@link-foundation/ui-core';
import { check } from './errors.js';
import { logFromLino, logToLino } from './log-lino.js';
import { SCHEMA_VERSION } from './idb/schema.js';
import { TREE_TAG, readTree, treeLink } from './bundle-tree.js';

/** The head of the first link of a bundle. */
export const BUNDLE_HEAD = 'ui_store_bundle';

/** The default limits of `importBundle`: the ones of ui-core. */
export const DEFAULT_BUNDLE_LIMITS = Object.freeze({
  maxDepth: DEFAULT_MAX_DEPTH,
  maxInputSize: DEFAULT_MAX_INPUT_SIZE,
});

/**
 * @typedef {object} BundleContent
 * @property {string} name
 * @property {number} snapshotTx
 * @property {{ roots: object[], unknown: unknown[] }} document
 * @property {string[] | undefined} ids
 * @property {import('./index.js').LogEntry[]} entries
 */

/**
 * @param {BundleContent} bundle
 * @returns {string}
 */
export function writeBundle({ name, snapshotTx, document, ids, entries }) {
  const unlimited = { maxDepth: Infinity, maxInputSize: Infinity };
  const documentLinks = parseLinks(
    format(document, { style: 'inline' }),
    unlimited
  );
  const exact = treeLink(document);
  const lossy =
    JSON.stringify(treeLink(readDocument(documentLinks, unlimited))) !==
    JSON.stringify(exact);
  const header = [
    BUNDLE_HEAD,
    ['schema', String(SCHEMA_VERSION)],
    ['name', name],
    ['snapshot_tx', String(snapshotTx)],
  ];
  return (
    formatLinks([
      header,
      ['document', ...documentLinks],
      ...(lossy ? [exact] : []),
      ...(ids === undefined ? [] : [['ids', ...ids]]),
    ]) + logToLino(entries)
  );
}

const bad = (condition, message) => check(condition, 'bad-bundle', message);

const isLink = (value) => Array.isArray(value) && value.length > 0;

/** The parts of a `(tag ...)` link, or `undefined`. */
const tagged = (value, tag) =>
  isLink(value) && value[0] === tag ? value.slice(1) : undefined;

/** `(key word)` links into an object of words. */
function fields(parts) {
  const found = {};
  for (const part of parts) {
    bad(
      isLink(part) && part.length === 2 && typeof part[1] === 'string',
      `Unexpected ${JSON.stringify(part)} in the bundle header`
    );
    bad(!Object.hasOwn(found, part[0]), `(${part[0]} ...) is given twice`);
    found[part[0]] = part[1];
  }
  return found;
}

/** The document of the parts of `(document ...)`, read as by `parse`. */
function readDocument(parts, options) {
  const document = parseOrThrow(formatLinks(parts), {
    ...options,
    checks: false,
  });
  return { roots: document.roots, unknown: document.unknown };
}

const integer = (text, what) => {
  const number = Number(text);
  bad(
    Number.isSafeInteger(number) && number >= 0 && String(number) === text,
    `${what} must be a non-negative integer`
  );
  return number;
};

/**
 * Read a bundle. Throws the `UiParseError` of ui-core when the text is
 * larger than `maxInputSize` or nested deeper than `maxDepth`, and a
 * `StoreError` (`bad-bundle`, or `bad-log` for a bad `tx` link) when it is
 * not a bundle.
 * @param {string} text
 * @param {{ maxDepth?: number, maxInputSize?: number }} [limits]
 * @returns {BundleContent}
 */
export function readBundle(text, limits = {}) {
  const options = { ...DEFAULT_BUNDLE_LIMITS, ...limits };
  bad(typeof text === 'string', 'A bundle is text');
  const [head, documentLink, ...rest] = parseLinks(text, options);
  const header = fields(
    tagged(head, BUNDLE_HEAD) ?? bad(false, 'Not a bundle')
  );
  bad(
    header.schema === String(SCHEMA_VERSION),
    `Unsupported bundle schema ${JSON.stringify(header.schema)}`
  );
  bad(typeof header.name === 'string', 'The bundle needs (name ...)');
  const snapshotTx = integer(header.snapshot_tx, 'snapshot_tx');
  const documentParts = tagged(documentLink, 'document');
  bad(documentParts, 'The second link of a bundle is (document ...)');
  let document = readDocument(documentParts, options);
  const tree = tagged(rest[0], TREE_TAG);
  if (tree) {
    rest.shift();
    document = readTree(tree);
  }
  const ids = tagged(rest[0], 'ids');
  if (ids) {
    rest.shift();
  }
  bad(
    ids === undefined || ids.every((id) => typeof id === 'string'),
    '(ids ...) holds words only'
  );
  const entries = rest.length === 0 ? [] : logFromLino(formatLinks(rest));
  let last = snapshotTx;
  for (const entry of entries) {
    bad(
      entry.tx > last,
      `Transaction ${entry.tx} must come after ${last} (snapshot_tx and the order of the log)`
    );
    last = entry.tx;
  }
  return {
    name: header.name,
    snapshotTx,
    document,
    ids,
    entries,
  };
}
