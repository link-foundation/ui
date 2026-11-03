/**
 * Shared helpers of the chart tests: the fixtures and the snapshot check
 * (`UPDATE_SNAPSHOTS=1` rewrites a snapshot).
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { URL } from 'node:url';

const FIXTURES = new URL('fixtures/', import.meta.url);

/** The text of a fixture of tests/charts/fixtures/. */
export const fixture = (name) => readFileSync(new URL(name, FIXTURES), 'utf8');

/** The names of the valid fixtures (every `.lino` but `bad-*.lino`). */
export const chartFixtures = () =>
  readdirSync(FIXTURES)
    .filter((name) => name.endsWith('.lino') && !name.startsWith('bad-'))
    .sort();

/** The text of a snapshot file, rewritten first when `UPDATE_SNAPSHOTS=1`. */
export function snapshot(name, actual) {
  const file = new URL(`__snapshots__/${name}`, import.meta.url);
  if (process.env.UPDATE_SNAPSHOTS === '1') {
    writeFileSync(file, actual);
  }
  return readFileSync(file, 'utf8');
}

/** The ChartSpecError a function throws (fails the test if none). */
export function thrown(fn) {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error('expected a ChartSpecError');
}
