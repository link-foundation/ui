/**
 * Shared helpers of the ui-settings tests: the fixtures, the schemas read
 * from them and a seeded random generator.
 */

import { readFileSync } from 'node:fs';
import { URL } from 'node:url';

import { readSchema } from '../src/index.js';

const fixtures = new URL('./fixtures/', import.meta.url);

/** A fixture of tests/fixtures. */
export const fixture = (name) => readFileSync(new URL(name, fixtures), 'utf8');

/** The schema of the issue (tests/fixtures/demo.schema.lino). */
export const demoSchema = () => readSchema(fixture('demo.schema.lino')).schema;

/** A subset of the immortality settings with its v1 → v2 migration. */
export const immortalitySchema = () =>
  readSchema(fixture('immortality.schema.lino')).schema;

/** The codes of a list of diagnostics. */
export const codes = (diagnostics) => diagnostics.map((d) => d.code);

/** A seeded generator (mulberry32): the same seed gives the same numbers. */
export function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** An in-memory Web Storage. */
export function memoryStorage(entries = {}) {
  const map = new Map(Object.entries(entries));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}
