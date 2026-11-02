/**
 * Reading settings schemas and values documents.
 *
 * The text is read only by the official `links-notation` parser (through
 * ui-core `parseLinks`). This module turns the raw values it returns into
 * records: one record per top-level link, with every form folded together.
 * `links-notation` returns a link written over several lines as a group
 * `(H (H line1) (H line2))`, a line with several links as one list, and the
 * indented form as `H`, `(H a)`, `(H b)`; all of them give the same record.
 */

import { parseLinks, UiParseError } from '@link-foundation/ui-core';

/** @typedef {import('@link-foundation/ui-core').RawValue} RawValue */

/**
 * One top-level link: `(id: values…)` or `(values…)` without an id.
 * @typedef {{ id: string|null, values: RawValue[] }} LinkRecord
 */

/**
 * A diagnostic, in the shape ui-core uses.
 * @typedef {{ code: string, severity: 'error'|'warning', message: string,
 *   at?: Record<string, unknown> }} Diagnostic
 */

/**
 * @param {string} code
 * @param {'error'|'warning'} severity
 * @param {string} message
 * @param {Record<string, unknown>} [at]
 * @returns {Diagnostic}
 */
export function diagnostic(code, severity, message, at) {
  return at === undefined
    ? { code, severity, message }
    : { code, severity, message, at };
}

/** Whether a list of diagnostics has an error. */
export const hasError = (diagnostics) =>
  diagnostics.some((d) => d.severity === 'error');

const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const sameValue = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * A multi-line group `(H (H a) (H b) …)`: the head `H` is a link, and every
 * other value is a path link with the same head.
 * @param {RawValue} value
 */
function isGroup(value) {
  if (!Array.isArray(value) || value.length < 2) {
    return false;
  }
  const [head, ...rest] = value;
  return (
    typeof head !== 'string' &&
    rest.every(
      (item) =>
        Array.isArray(item) && item.length >= 2 && sameValue(item[0], head)
    )
  );
}

/** A line that holds several links: a list whose values are all links. */
const isLine = (value) =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every((item) => typeof item !== 'string') &&
  !isGroup(value);

/** The payload of continuation lines, one value per link of each line. */
function lineValues(payload) {
  return payload.flatMap((item) =>
    isLine(item) ? item.map(unfold) : [unfold(item)]
  );
}

/** Append values to a link (an atom becomes a list). */
function append(head, extra) {
  if (typeof head === 'string') {
    return [head, ...extra];
  }
  if (Array.isArray(head)) {
    return [...head, ...extra];
  }
  return { id: head.id, values: [...head.values, ...extra] };
}

/**
 * A raw value with every multi-line group folded into one link.
 * @param {RawValue} value
 * @returns {RawValue}
 */
export function unfold(value) {
  if (typeof value === 'string') {
    return value;
  }
  if (isObject(value)) {
    return { id: value.id, values: value.values.map(unfold) };
  }
  if (isGroup(value)) {
    const [head, ...rest] = value;
    return append(
      unfold(head),
      lineValues(rest.flatMap((item) => item.slice(1)))
    );
  }
  return value.map(unfold);
}

function recordOf(value) {
  if (typeof value === 'string') {
    return { id: null, values: [value] };
  }
  if (Array.isArray(value)) {
    return { id: null, values: value };
  }
  return { id: value.id, values: value.values };
}

function collect(list, records, known) {
  for (const value of list) {
    const isList = Array.isArray(value);
    if (
      isList &&
      value.length >= 2 &&
      typeof value[0] !== 'string' &&
      known.has(JSON.stringify(value[0]))
    ) {
      // The indented form: `(H a)` adds `a` to the record `H`.
      known
        .get(JSON.stringify(value[0]))
        .values.push(...lineValues(value.slice(1)));
    } else if (isList && !isGroup(value) && typeof value[0] !== 'string') {
      // Several top-level links written on one line.
      collect(value, records, known);
    } else {
      const record = recordOf(unfold(value));
      records.push(record);
      known.set(JSON.stringify(value), record);
    }
  }
}

/**
 * Read text into top-level records. Never throws: a syntax error or input
 * that is too large becomes a diagnostic.
 * @param {unknown} text
 * @param {{ maxInputSize?: number }} [options]
 * @returns {{ records: LinkRecord[], diagnostics: Diagnostic[] }}
 */
export function readRecords(text, options = {}) {
  if (typeof text !== 'string') {
    return {
      records: [],
      diagnostics: [diagnostic('not-text', 'error', 'The input is not text')],
    };
  }
  let raw;
  try {
    raw = parseLinks(text, options);
  } catch (error) {
    if (error instanceof UiParseError) {
      return { records: [], diagnostics: [...error.diagnostics] };
    }
    throw error;
  }
  const records = [];
  collect(raw, records, new Map());
  return { records, diagnostics: [] };
}

/**
 * The clauses of a record: `(name args…)` lists and bare words (flags).
 * @param {RawValue[]} values
 * @returns {Array<{ name: string, args: RawValue[] }>}
 */
export function clausesOf(values) {
  const out = [];
  for (const value of values) {
    if (typeof value === 'string') {
      out.push({ name: value, args: [] });
    } else if (Array.isArray(value) && typeof value[0] === 'string') {
      out.push({ name: value[0], args: value.slice(1) });
    } else {
      out.push({ name: '', args: [value] });
    }
  }
  return out;
}

/** The raw value of clause arguments: one atom, or the list of them. */
export const rawOf = (args) => (args.length === 1 ? args[0] : args);

/** Keys that would reach the prototype of a plain object. */
export const UNSAFE_KEYS = Object.freeze([
  '__proto__',
  'constructor',
  'prototype',
]);
