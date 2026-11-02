/**
 * Values documents and share links.
 *
 * A values document stores only what differs from the defaults:
 *
 * ```lino
 * (settings (version 2) (liquid.blur 24))
 * ```
 *
 * A share link is `#settings=<encodeURIComponent(values document)>`. The
 * readers also take the JSON links of the sites that came before:
 * `#ui=<JSON {v:2,…}>` (immortality) and `#settings=<JSON {"a.b":…}>`
 * (konard.github.io).
 */

import { formatLinks } from '@link-foundation/ui-core';

import { formatValue } from './coerce.js';
import { applySharedLook } from './presets.js';
import { migrate } from './migrate.js';
import { clausesOf, diagnostic, rawOf, readRecords } from './read.js';
import { diff, merge } from './values.js';

/** @typedef {import('./schema.js').SettingsSchema} SettingsSchema */
/** @typedef {import('./values.js').SettingsValues} SettingsValues */
/** @typedef {import('./read.js').Diagnostic} Diagnostic */

/** The largest share hash read, in characters (8 KiB). */
export const MAX_SHARE_HASH = 8 * 1024;

/** The hash parameter of share links. */
export const SHARE_PARAM = 'settings';

/** The hash parameter of immortality share links. */
export const LEGACY_SHARE_PARAM = 'ui';

/**
 * Write values as a values document: only the values that differ from the
 * defaults, in schema order.
 * @param {SettingsSchema} schema
 * @param {SettingsValues} values
 * @returns {string} e.g. `(settings (version 2) (liquid.blur 24))`
 */
export function toLino(schema, values) {
  const changed = diff(schema, values);
  const pairs = Object.entries(changed).map(([key, value]) => [
    key,
    ...formatValue(schema.fields.get(key), value),
  ]);
  return formatLinks([
    ['settings', ['version', String(schema.version)], ...pairs],
  ]).trimEnd();
}

/** The `settings` record of a values document, or `null`. */
function settingsRecord(records) {
  for (const { id, values } of records) {
    if (id === 'settings') {
      return values;
    }
    if (id === null && values[0] === 'settings') {
      return values.slice(1);
    }
  }
  return null;
}

/**
 * @typedef {{ ok: boolean, values: SettingsValues, rejected: string[],
 *   version: number, diagnostics: Diagnostic[] }} ReadResult
 */

/**
 * Read a values document (migrating older versions). Never throws: a
 * document that cannot be read gives `ok: false` and `base`.
 * @param {SettingsSchema} schema
 * @param {string} text
 * @param {{ base?: SettingsValues, look?: boolean, maxInputSize?: number }} [options]
 * @returns {ReadResult}
 */
export function fromLino(schema, text, options = {}) {
  const { base, look, maxInputSize } = options;
  const read = readRecords(text, maxInputSize ? { maxInputSize } : {});
  const clauses = settingsRecord(read.records);
  if (clauses === null) {
    const diagnostics = read.diagnostics.length
      ? read.diagnostics
      : [diagnostic('no-settings', 'error', 'No (settings …) link')];
    return {
      ok: false,
      ...merge(schema, base, undefined),
      version: schema.version,
      diagnostics,
    };
  }
  const stored = {};
  let version;
  for (const { name, args } of clausesOf(clauses)) {
    if (name === 'version' && args.length === 1) {
      version = Number(args[0]);
    } else if (name !== '' && !Object.hasOwn(stored, name)) {
      stored[name] = rawOf(args);
    }
  }
  const out = migrate(
    schema,
    {
      version: Number.isInteger(version) ? version : undefined,
      values: stored,
    },
    { base, look }
  );
  return { ok: true, ...out };
}

function parseJson(json) {
  if (typeof json !== 'string') {
    return json;
  }
  try {
    return JSON.parse(json);
  } catch {
    return undefined;
  }
}

/**
 * Read the JSON settings of the earlier sites: immortality `{ v: 2, … }`
 * (an object without `v` is version 1) and konard.github.io flat dotted keys
 * (pass `{ version: schema.version }`, they have no version). Never throws.
 * @param {SettingsSchema} schema
 * @param {string|object} json
 * @param {{ version?: number, base?: SettingsValues, look?: boolean }} [options]
 * @returns {ReadResult}
 */
export function fromLegacyJson(schema, json, options = {}) {
  const raw = parseJson(json);
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      ok: false,
      ...merge(schema, options.base, undefined),
      version: schema.version,
      diagnostics: [diagnostic('bad-json', 'error', 'Not a JSON object')],
    };
  }
  const { v, ...values } = raw;
  const version = Number.isInteger(v) ? v : (options.version ?? 1);
  const out = migrate(
    schema,
    { version, values },
    { base: options.base, look: options.look }
  );
  return { ok: true, ...out };
}

/**
 * The share hash of values: `#settings=<encodeURIComponent(toLino(…))>`.
 * @param {SettingsSchema} schema
 * @param {SettingsValues} values
 */
export const toShareHash = (schema, values) =>
  `#${SHARE_PARAM}=${encodeURIComponent(toLino(schema, values))}`;

/** The value of a hash parameter, or `undefined`. */
function hashParam(hash, name) {
  const body = hash.startsWith('#') ? hash.slice(1) : hash;
  const part = body.split('&').find((p) => p.startsWith(`${name}=`));
  return part?.slice(name.length + 1);
}

function decode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

function readShared(schema, param, text) {
  const look = { look: true };
  if (param === LEGACY_SHARE_PARAM) {
    return {
      format: 'immortality-json',
      ...fromLegacyJson(schema, text, look),
    };
  }
  if (text.trimStart().startsWith('{')) {
    return {
      format: 'konard-json',
      ...fromLegacyJson(schema, text, { ...look, version: schema.version }),
    };
  }
  return { format: 'lino', ...fromLino(schema, text, look) };
}

/**
 * Read a share hash and apply the shared look to the viewer's values: the
 * viewer keeps their comfort settings. Reads `#settings=<LiNo>`,
 * `#settings=<JSON>` (konard.github.io) and `#ui=<JSON>` (immortality).
 * Hashes over 8 KiB are rejected. Never throws; `ok: false` leaves the
 * viewer's values as they were.
 * @param {SettingsSchema} schema
 * @param {string} hash `location.hash`
 * @param {SettingsValues} [viewerValues] default: the defaults
 * @returns {ReadResult & { format: string|null }}
 */
export function fromShareHash(schema, hash, viewerValues) {
  const viewer = merge(schema, viewerValues, undefined).values;
  const failed = (code, message) => ({
    ok: false,
    format: null,
    values: viewer,
    rejected: [],
    version: schema.version,
    diagnostics: [diagnostic(code, 'error', message)],
  });
  if (typeof hash !== 'string') {
    return failed('no-settings', 'The hash is not text');
  }
  if (hash.length > MAX_SHARE_HASH) {
    return failed(
      'hash-too-large',
      `The hash is ${hash.length} characters; the limit is ${MAX_SHARE_HASH}`
    );
  }
  const param = [SHARE_PARAM, LEGACY_SHARE_PARAM].find(
    (name) => hashParam(hash, name) !== undefined
  );
  if (!param) {
    return failed('no-settings', 'The hash has no settings');
  }
  const text = decode(hashParam(hash, param));
  if (text === undefined) {
    return failed('bad-encoding', 'The hash is not URI-encoded text');
  }
  const shared = readShared(schema, param, text);
  if (!shared.ok) {
    return { ...shared, values: viewer };
  }
  return { ...shared, values: applySharedLook(schema, viewer, shared.values) };
}
