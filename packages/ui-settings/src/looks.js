import { formatLinks } from '@link-foundation/ui-core';
import { readRecords, clausesOf } from './read.js';
import { toLino, fromLino } from './codec.js';

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
    const result = fromLino(schema, document);
    if (!result.ok || result.rejected.length) {
      ok = false;
    } else {
      looks[name] = result.values;
    }
  }
  return { ok, looks };
}
