/**
 * The `message` value type: `(t KEY)` and `(t KEY (PARAM VALUE) ...)` refer
 * to a catalog message where literal text would stand, e.g.
 * `(ok: button (label (t ok.label)))` or
 * `(greeting: text (t greeting (name 'Ada')))`.
 *
 * ui-core (#15) has no registry of value types, so this module types
 * messages itself and hands every other value to ui-core `values.typeValue`.
 */

import { values } from '@link-foundation/ui-core';

/**
 * @typedef {import('@link-foundation/ui-core').RawValue} RawValue
 * @typedef {string | number | Message} MessageParam
 * @typedef {{ type: 'message', key: string, params: Record<string, MessageParam> }} Message
 */

/** The head of a message link: `t`. */
export const MESSAGE_HEAD = 't';

/** Whether a typed value is a message. */
export const isMessage = (value) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  value.type === 'message' &&
  typeof value.key === 'string';

/** Whether a raw value is a `(t ...)` link (well formed or not). */
export const isMessageLink = (raw) =>
  Array.isArray(raw) && raw[0] === MESSAGE_HEAD;

/** A param value: a number atom becomes a number (for plurals). */
function paramValue(raw) {
  if (typeof raw === 'string') {
    const number = values.parseNumber(raw);
    return number === null ? raw : number;
  }
  const nested = parseMessage(raw);
  return nested ?? null;
}

/**
 * Read a raw `(t KEY (PARAM VALUE) ...)` link.
 * @param {RawValue} raw
 * @returns {Message|null|undefined} `undefined` when `raw` is not a message
 *   link, `null` when it is a malformed one (`(t)`, `(t (a))`, `(t k x)`)
 */
export function parseMessage(raw) {
  if (!isMessageLink(raw)) {
    return undefined;
  }
  const [, key, ...rest] = raw;
  if (typeof key !== 'string' || key === '') {
    return null;
  }
  /** @type {Record<string, MessageParam>} */
  const params = {};
  for (const param of rest) {
    if (
      !Array.isArray(param) ||
      param.length !== 2 ||
      typeof param[0] !== 'string'
    ) {
      return null;
    }
    const value = paramValue(param[1]);
    if (value === null) {
      return null;
    }
    params[param[0]] = value;
  }
  return { type: 'message', key, params };
}

/**
 * Create a message value.
 * @param {string} key
 * @param {Record<string, MessageParam>} [params]
 * @returns {Message}
 */
export const message = (key, params = {}) => ({
  type: 'message',
  key,
  params: { ...params },
});

/**
 * The raw form of a message, as ui-core `format` writes it.
 * @param {Message} value
 * @returns {RawValue}
 */
export function messageRaw(value) {
  const params = Object.entries(value.params ?? {}).map(([name, param]) => [
    name,
    isMessage(param) ? messageRaw(param) : String(param),
  ]);
  return [MESSAGE_HEAD, value.key, ...params];
}

/**
 * ui-core `values.typeValue` with the `message` type: a `(t ...)` link is a
 * message whatever the declared type, a malformed one is an `invalid-value`
 * error with `expected: 'message'`.
 * @param {RawValue} raw
 * @param {object} [spec]
 * @param {object} [options]
 * @returns {{ value: object|null, diagnostics: object[] }}
 */
export function typeValue(raw, spec, options = {}) {
  const parsed = parseMessage(raw);
  if (parsed === undefined) {
    return values.typeValue(raw, spec, options);
  }
  if (parsed !== null) {
    return { value: parsed, diagnostics: [] };
  }
  return {
    value: null,
    diagnostics: [
      {
        code: 'invalid-value',
        severity: 'error',
        message: `malformed message reference: expected (t KEY (PARAM VALUE) ...)`,
        at: { ...(options.at ?? {}) },
        expected: 'message',
      },
    ],
  };
}
