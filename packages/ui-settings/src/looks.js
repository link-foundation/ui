import {
  formatLinks,
  parseLinks,
  UiParseError,
} from '@link-foundation/ui-core';
import { readRecords, clausesOf } from './read.js';
import { toLino, fromLino, fromLegacyJson } from './codec.js';

/** A looks collection carries ordinary versioned settings documents. */
export function looksToLino(schema, looks) {
  return formatLinks([
    [
      'looks',
      ...Object.entries(looks).map(([name, values]) => [
        'look',
        ['name', name],
        ['document', toLino(schema, values)],
      ]),
    ],
  ]);
}

/** null means a settings document; an invalid collection is rejected atomically. */
export function looksFromLino(schema, text) {
  const { records, diagnostics } = readRecords(text);
  if (records[0]?.values[0] !== 'looks') {
    return null;
  }
  const looks = Object.create(null);
  let ok = !diagnostics.length && records.length === 1;
  for (const clause of clausesOf(records[0].values.slice(1))) {
    const props = new Map(clausesOf(clause.args).map((c) => [c.name, c.args]));
    const name = props.get('name')?.[0];
    const document = props.get('document')?.[0];
    if (
      clause.name !== 'look' ||
      typeof name !== 'string' ||
      !name.trim() ||
      name.length > 60 ||
      typeof document !== 'string'
    ) {
      ok = false;
      continue;
    }
    const result = fromLino(schema, document, { look: true });
    if (!result.ok || result.rejected.length) {
      ok = false;
    } else {
      looks[name] = result.values;
    }
  }
  return { ok, looks };
}

/** Read canonical looks, legacy JSON presets, or the legacy nested presets format. */
export function looksFromText(schema, text) {
  if (typeof text !== 'string') {
    return null;
  }
  const start = text.trimStart()[0];
  if (start === '{' || start === '[') {
    return readJsonLooks(schema, text);
  }
  const current = looksFromLino(schema, text);
  return current ?? (start === '(' ? readNestedLooks(schema, text) : null);
}

function collectLooks(entries, read) {
  if (!Array.isArray(entries)) {
    return { ok: false, looks: {} };
  }
  const looks = Object.create(null);
  for (const entry of entries) {
    const { name, result } = read(entry) ?? {};
    if (
      typeof name !== 'string' ||
      !name.trim() ||
      name.trim().length > 60 ||
      !result?.ok ||
      result.rejected.length
    ) {
      return { ok: false, looks: {} };
    }
    looks[name.trim()] = result.values;
  }
  return { ok: true, looks };
}

function readJsonLooks(schema, text) {
  let object;
  try {
    object = JSON.parse(text);
  } catch {
    return null;
  }
  const entries = Array.isArray(object) ? object : object?.presets;
  if (entries === undefined) {
    return null;
  }
  return collectLooks(entries, (entry) => ({
    name: entry?.name,
    result: fromLegacyJson(schema, entry?.look, {
      version: schema.version,
      look: true,
    }),
  }));
}

/** A single property has no extra wrapper in the parser's raw value. */
function nestedList(value) {
  return value === null ? [] : typeof value?.[0] === 'string' ? [value] : value;
}

function nestedEntry(schema, entry) {
  if (!Array.isArray(entry)) {
    return null;
  }
  const clauses = new Map(
    clausesOf(entry).map(({ name, args }) => [name, args])
  );
  if (!clauses.has('look')) {
    return null;
  }
  const [name] = clauses.get('name') ?? [];
  const values = nestedList(clauses.get('look')[0]);
  return {
    name,
    result: Array.isArray(values)
      ? fromLino(schema, formatLinks([['settings', ...values]]), { look: true })
      : null,
  };
}

function readNestedLooks(schema, text) {
  let raw;
  try {
    raw = parseLinks(text);
  } catch (error) {
    if (error instanceof UiParseError) {
      return null;
    }
    throw error;
  }
  if (raw.length !== 1) {
    return null;
  }
  const [root] = raw;
  if (root === null) {
    return { ok: true, looks: {} };
  }
  if (!Array.isArray(root)) {
    return null;
  }
  if (root[0] === 'presets') {
    return collectLooks(nestedList(root[1]), (entry) =>
      nestedEntry(schema, entry)
    );
  }
  return root.some(
    (entry) =>
      Array.isArray(entry) && entry.some((clause) => clause?.[0] === 'look')
  )
    ? collectLooks(root, (entry) => nestedEntry(schema, entry))
    : null;
}
