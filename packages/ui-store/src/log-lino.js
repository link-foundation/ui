/**
 * The operation log as Links Notation: one link per transaction.
 *
 * ```lino
 * (tx 4 (origin devmode) (label 'Edit label') (setProp ok label 'Cancel'))
 * (tx 5 (origin undo) (undoes 4) (setProp ok label 'OK'))
 * ```
 *
 * The text is written with `formatLinks` and read with `parseLinks` of
 * `@link-foundation/ui-core` (no regular expressions). The forms of the
 * operations are listed in README.md ("Operation log").
 */

import { formatLinks, parseLinks } from '@link-foundation/ui-core';
import { StoreError, check } from './errors.js';

/** @typedef {import('./ops.js').Op} Op */
/** @typedef {import('@link-foundation/ui-core').RawValue} RawValue */

const META = ['origin', 'label', 'undoes', 'redoes'];

const optional = (condition, value) => (condition ? [value] : []);

/** `(parent p) (at i)`; a root position has no `parent`. */
const position = (parentId, index) => [
  ...optional(parentId !== null, ['parent', parentId]),
  ['at', String(index)],
];

function encodeNode(node) {
  return [
    'node',
    ...optional(node.id !== null, ['id', node.id]),
    ...optional(node.kind !== null, ['kind', node.kind]),
    ...optional(node.positional.length > 0, ['positional', ...node.positional]),
    ...optional(node.properties.length > 0, [
      'properties',
      ...node.properties.map((p) => [p.name, ...p.values]),
    ]),
    ...optional(node.unknown.length > 0, ['unknown', ...node.unknown]),
    ...optional(node.children.length > 0, [
      'children',
      ...node.children.map(encodeNode),
    ]),
  ];
}

const at = (op) => optional(op.index !== undefined, ['at', String(op.index)]);

const ENCODE = {
  insert: (op) => [
    'insert',
    ...position(op.parentId, op.index),
    ['ids', ...op.ids],
    encodeNode(op.node),
  ],
  remove: (op) => ['remove', op.id],
  move: (op) => ['move', op.id, ...position(op.parentId, op.index)],
  setProp: (op) => ['setProp', ...at(op), op.id, op.name, ...op.values],
  removeProp: (op) => ['removeProp', ...at(op), op.id, op.name],
  setPositional: (op) => ['setPositional', op.id, ...op.values],
  rename: (op) =>
    op.to === null
      ? ['rename', op.id, ['anonymous', op.as]]
      : ['rename', op.id, op.to],
};

/**
 * One log entry as a raw links value.
 * @param {import('./index.js').LogEntry} entry
 */
function encodeEntry(entry) {
  return [
    'tx',
    String(entry.tx),
    ['origin', entry.origin],
    ...optional(entry.label !== null && entry.label !== undefined, [
      'label',
      entry.label,
    ]),
    ...optional(entry.undoes !== undefined, ['undoes', String(entry.undoes)]),
    ...optional(entry.redoes !== undefined, ['redoes', String(entry.redoes)]),
    ...entry.ops.map((op) => ENCODE[op.op](op)),
  ];
}

/**
 * The log (from `store.log()`) as Links Notation text, one transaction per
 * line.
 * @param {readonly import('./index.js').LogEntry[]} entries
 * @returns {string}
 */
export function logToLino(entries) {
  return formatLinks(entries.map(encodeEntry));
}

// Reading: every check throws a StoreError with the code `bad-log`.

const fail = (message) => {
  throw new StoreError('bad-log', message);
};

const isLink = (value) => Array.isArray(value) && value.length > 0;

/** @returns {string} */
function atom(value, what) {
  check(typeof value === 'string', 'bad-log', `${what} must be a word`);
  return value;
}

function integer(value, what) {
  const text = atom(value, what);
  const number = Number(text);
  check(
    Number.isSafeInteger(number) && number >= 0 && String(number) === text,
    'bad-log',
    `${what} must be a non-negative integer, not "${text}"`
  );
  return number;
}

/** The parts of a `(tag ...)` link, or `undefined` for another value. */
const tagged = (value, tag) =>
  isLink(value) && value[0] === tag ? value.slice(1) : undefined;

/** The single word of a `(tag word)` link. */
function single(parts, what) {
  check(parts.length === 1, 'bad-log', `(${what} ...) takes one value`);
  return atom(parts[0], what);
}

/**
 * Read `(tag ...)` parts into an object; every tag at most once.
 * @param {RawValue[]} parts
 * @param {string[]} tags
 * @param {string} where
 */
function sections(parts, tags, where) {
  const found = {};
  for (const part of parts) {
    const head = isLink(part) ? part[0] : undefined;
    check(
      tags.includes(head) && !Object.hasOwn(found, head),
      'bad-log',
      `Unexpected ${JSON.stringify(part)} in ${where}`
    );
    found[head] = part.slice(1);
  }
  return found;
}

/** `{ parentId, index }` from the `parent` and `at` sections. */
function decodePosition(found, what) {
  check(found.at, 'bad-log', `${what} needs (at index)`);
  return {
    parentId: found.parent ? single(found.parent, 'parent') : null,
    index: integer(single(found.at, 'at'), 'at'),
  };
}

function decodeProperty(link) {
  check(isLink(link), 'bad-log', 'A property is a link (name values...)');
  return { name: atom(link[0], 'A property name'), values: link.slice(1) };
}

function decodeNode(value) {
  const parts = tagged(value, 'node');
  check(parts, 'bad-log', 'insert needs a (node ...) link');
  const found = sections(
    parts,
    ['id', 'kind', 'positional', 'properties', 'unknown', 'children'],
    'a node'
  );
  return {
    id: found.id ? single(found.id, 'id') : null,
    kind: found.kind ? single(found.kind, 'kind') : null,
    positional: found.positional ?? [],
    properties: (found.properties ?? []).map(decodeProperty),
    children: (found.children ?? []).map(decodeNode),
    unknown: found.unknown ?? [],
  };
}

/** Split `[(at i)] id name rest...` of setProp and removeProp. */
function propertyOp(op, parts) {
  const index = tagged(parts[0], 'at');
  const rest = index ? parts.slice(1) : parts;
  check(rest.length >= 2, 'bad-log', `${op} needs an id and a name`);
  return {
    op,
    id: atom(rest[0], `${op} id`),
    name: atom(rest[1], `${op} name`),
    ...(index ? { index: integer(single(index, 'at'), 'at') } : {}),
    values: rest.slice(2),
  };
}

const DECODE = {
  insert(parts) {
    const found = sections(parts, ['parent', 'at', 'ids', 'node'], 'insert');
    check(found.ids && found.node, 'bad-log', 'insert needs (ids) and (node)');
    return {
      op: 'insert',
      ...decodePosition(found, 'insert'),
      node: decodeNode(['node', ...found.node]),
      ids: found.ids.map((id) => atom(id, 'insert id')),
    };
  },
  remove: (parts) => ({ op: 'remove', id: single(parts, 'remove') }),
  move(parts) {
    check(parts.length >= 2, 'bad-log', 'move needs an id and (at index)');
    return {
      op: 'move',
      id: atom(parts[0], 'move id'),
      ...decodePosition(
        sections(parts.slice(1), ['parent', 'at'], 'move'),
        'move'
      ),
    };
  },
  setProp: (parts) => propertyOp('setProp', parts),
  removeProp(parts) {
    const { values, ...op } = propertyOp('removeProp', parts);
    check(values.length === 0, 'bad-log', 'removeProp takes no values');
    return op;
  },
  setPositional(parts) {
    check(parts.length >= 1, 'bad-log', 'setPositional needs an id');
    return {
      op: 'setPositional',
      id: atom(parts[0], 'setPositional id'),
      values: parts.slice(1),
    };
  },
  rename(parts) {
    check(parts.length === 2, 'bad-log', 'rename takes an id and a target');
    const id = atom(parts[0], 'rename id');
    const anonymous = tagged(parts[1], 'anonymous');
    return anonymous
      ? { op: 'rename', id, to: null, as: single(anonymous, 'anonymous') }
      : { op: 'rename', id, to: atom(parts[1], 'rename target') };
  },
};

function decodeOp(value) {
  const head = isLink(value) ? value[0] : undefined;
  if (!Object.hasOwn(DECODE, head)) {
    fail(`Unknown operation ${JSON.stringify(value)}`);
  }
  return DECODE[head](value.slice(1));
}

function decodeEntry(value) {
  const parts = tagged(value, 'tx');
  check(parts?.length >= 2, 'bad-log', 'Every log link is (tx n ...)');
  const [tx, ...rest] = parts;
  const meta = rest.filter((part) => isLink(part) && META.includes(part[0]));
  const found = sections(meta, META, 'a transaction');
  check(found.origin, 'bad-log', 'A transaction needs (origin ...)');
  return {
    tx: integer(tx, 'tx'),
    origin: single(found.origin, 'origin'),
    label: found.label ? single(found.label, 'label') : null,
    ...(found.undoes
      ? { undoes: integer(single(found.undoes, 'undoes'), 'undoes') }
      : {}),
    ...(found.redoes
      ? { redoes: integer(single(found.redoes, 'redoes'), 'redoes') }
      : {}),
    ops: rest.filter((part) => !meta.includes(part)).map(decodeOp),
  };
}

/**
 * Read a log written by `logToLino`. Throws a `StoreError` with the code
 * `bad-log` when the text is not in the log format (and the `UiParseError`
 * of ui-core when it is not Links Notation).
 * @param {string} text
 * @returns {import('./index.js').LogEntry[]}
 */
export function logFromLino(text) {
  return parseLinks(text).map(decodeEntry);
}
