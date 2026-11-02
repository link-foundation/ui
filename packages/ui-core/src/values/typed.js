/**
 * Schema-driven typing (docs/spec/values.md): the property type declared in
 * the vocabulary decides how a raw value is read. Wrong values become
 * `invalid-value` diagnostics, `@x` / `$x` become `reserved-sigil` warnings;
 * nothing here throws.
 */

import { diagnostic } from '../diagnostics.js';
import { valueLink } from '../links.js';
import { defaultVocabulary } from '../vocabulary.js';
import { parseColor } from './color.js';
import { inferValue } from './infer.js';
import { parseReference, sigilDiagnostics } from './refs.js';
import {
  hasReservedSigil,
  isTokenName,
  isUrl,
  parseDimension,
  parseDuration,
  parseNumber,
} from './scalars.js';

/**
 * @typedef {import('./types.js').TypedValue} TypedValue
 * @typedef {import('./types.js').ValueType} ValueType
 * @typedef {import('../types.js').RawValue} RawValue
 * @typedef {import('../types.js').Vocabulary} Vocabulary
 * @typedef {import('../types.js').Diagnostic} Diagnostic
 */

const quantity = (type, parsed) =>
  parsed === null ? null : { type, ...parsed };

/** Readers of the atom types: atom text -> typed value or `null`. */
const ATOMS = {
  string: (value) => ({ type: 'string', value }),
  number: (text) => {
    const value = parseNumber(text);
    return value === null ? null : { type: 'number', value };
  },
  dimension: (text) => quantity('dimension', parseDimension(text)),
  duration: (text) => quantity('duration', parseDuration(text)),
  color: parseColor,
  url: (value) => (isUrl(value) ? { type: 'url', value } : null),
  'element-ref': (id) => ({ type: 'element-ref', id }),
  'element-ref-or-url': (text) =>
    text.includes(':') || text.includes('/')
      ? ATOMS.url(text)
      : ATOMS['element-ref'](text),
  'token-name': (value) => (isTokenName(value) ? ATOMS.string(value) : null),
  boolean: (text) =>
    text === 'true' || text === 'false'
      ? { type: 'boolean', value: text === 'true' }
      : null,
  action: (name) => ({ type: 'action', name, args: [] }),
};

/**
 * The arguments of an action, typed by its `(argument name type)` entries in
 * the vocabulary. Handlers are checked by the parser (`invalid-handler`,
 * `unknown-action`, `unsafe-url`), so an argument that does not match its
 * declared type, or has none, is inferred and never rejected.
 */
function typeAction([name, ...args], vocabulary) {
  if (typeof name !== 'string') {
    return null;
  }
  const declared = vocabulary.actions.get(name) ?? [];
  return {
    type: 'action',
    name,
    args: args.map(
      (arg, i) => typeAs(arg, declared[i]?.[1], vocabulary) ?? inferValue(arg)
    ),
  };
}

/**
 * Type `raw` as `type`; `null` when it does not match.
 * @param {RawValue} raw
 * @param {ValueType|undefined} type  `undefined` and `any` infer the type
 * @param {Vocabulary} vocabulary
 * @returns {TypedValue|null}
 */
function typeAs(raw, type, vocabulary) {
  if (typeof raw === 'string' && hasReservedSigil(raw)) {
    return { type: 'string', value: raw }; // reported as reserved-sigil
  }
  const reference = parseReference(raw, (option) =>
    typeAs(option, type, vocabulary)
  );
  if (reference !== undefined) {
    return reference;
  }
  if (type === undefined || type === 'any') {
    return inferValue(raw);
  }
  if (Array.isArray(type)) {
    return type[0] === 'enum' && type.slice(1).includes(raw)
      ? { type: 'enum', value: /** @type {string} */ (raw) }
      : null;
  }
  if (typeof raw === 'string') {
    return Object.hasOwn(ATOMS, type) ? ATOMS[type](raw) : ATOMS.string(raw);
  }
  if (type === 'color') {
    return parseColor(raw);
  }
  return type === 'action' && Array.isArray(raw)
    ? typeAction(raw, vocabulary)
    : null;
}

/** A type as text for the `expected` field: `dimension`, `(enum a b)`. */
const typeText = (type) =>
  Array.isArray(type) ? valueLink(type).format() : String(type);

/**
 * Type one raw value with a property spec.
 * @param {RawValue} raw  an atom string or a nested link (array)
 * @param {import('./types.js').ValueSpec} [spec]  default `{ type: 'any' }`
 * @param {import('./types.js').TypeOptions} [options]
 * @returns {import('./types.js').TypedResult}
 */
export function typeValue(raw, spec = { type: 'any' }, options = {}) {
  const at = options.at ?? {};
  const vocabulary = options.vocabulary ?? defaultVocabulary();
  const diagnostics = sigilDiagnostics(raw, at);
  const value = typeAs(raw, spec.type, vocabulary);
  if (value === null) {
    diagnostics.push({
      ...diagnostic('invalid-value', 'error', { ...at }),
      expected: typeText(spec.type),
    });
  }
  return { value, diagnostics };
}

/**
 * Whether a value matches a vocabulary property type.
 * @param {ValueType|undefined} type
 * @param {RawValue} value
 * @returns {boolean}
 */
export const valueMatches = (type, value) =>
  typeAs(value, type, defaultVocabulary()) !== null;

/**
 * The spec of the i-th value of a property: the event of an `on` handler is
 * a string, values of a `string` property that are links are not checked
 * (docs/spec/values.md) and are inferred.
 */
function specAt(spec, i, raw) {
  if (spec.type === 'action' && i === 0) {
    return { type: 'string' };
  }
  return spec.type === 'string' && typeof raw !== 'string'
    ? { type: 'any' }
    : spec;
}

function typeValues(values, spec, at, context) {
  return values.map((raw, i) => {
    const { value, diagnostics } = typeValue(raw, specAt(spec, i, raw), {
      at,
      vocabulary: context.vocabulary,
    });
    context.diagnostics.push(...diagnostics);
    return value;
  });
}

const ANY = { type: 'any' };

function typeNodeIn(node, context) {
  const kind = context.vocabulary.kinds.get(node.kind);
  const element = { element: node.id };
  const typedPositional = node.positional.map((raw, i) => {
    const property = kind?.positional[i];
    const spec = kind?.properties.get(property) ?? ANY;
    return typeValues([raw], spec, element, context)[0];
  });
  const properties = node.properties.map((property) => {
    const at = { element: node.id, property: property.name };
    const spec = kind?.properties.get(property.name);
    if (kind !== undefined && spec === undefined) {
      context.diagnostics.push(
        diagnostic('unknown-sublink', 'warning', {
          element: node.id,
          head: property.name,
        })
      );
    }
    return {
      ...property,
      typed: typeValues(property.values, spec ?? ANY, at, context),
    };
  });
  return {
    ...node,
    typedPositional,
    properties,
    children: node.children.map((child) => typeNodeIn(child, context)),
  };
}

/**
 * Type every value of an element and its children. Each property gets a
 * `typed` array next to its `values` (`null` for an invalid value) and the
 * node gets `typedPositional`. Properties of an unknown kind are inferred.
 * @param {import('../types.js').UiNode} node
 * @param {Vocabulary} [vocabulary]  default: docs/spec/vocabulary.lino
 * @param {Diagnostic[]} [diagnostics]  `invalid-value`, `reserved-sigil`
 *   and `unknown-sublink` are appended here
 * @returns {import('./types.js').TypedUiNode}
 */
export function typeNode(
  node,
  vocabulary = defaultVocabulary(),
  diagnostics = []
) {
  return typeNodeIn(node, { vocabulary, diagnostics });
}

/**
 * Type every root of a parsed document.
 * @param {Pick<import('../types.js').UiDocument, 'roots'>} doc
 * @param {Vocabulary} [vocabulary]
 * @returns {{ roots: import('./types.js').TypedUiNode[], diagnostics: Diagnostic[] }}
 */
export function typeDocument(doc, vocabulary = defaultVocabulary()) {
  const diagnostics = [];
  const roots = doc.roots.map((root) =>
    typeNode(root, vocabulary, diagnostics)
  );
  return { roots, diagnostics };
}
