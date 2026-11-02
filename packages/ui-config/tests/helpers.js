/**
 * Shared helpers of the ui-config tests: the issue-1 sample documents and
 * the fixtures of this package.
 */

import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { parse } from '@link-foundation/ui-core';

const samples = new URL(
  '../../../docs/case-studies/issue-1/samples/',
  import.meta.url
);
const fixtures = new URL('./fixtures/', import.meta.url);

/** A sample of docs/case-studies/issue-1/samples. */
export const sample = (name) => readFileSync(new URL(name, samples), 'utf8');

/** A fixture of tests/fixtures. */
export const fixture = (name) => readFileSync(new URL(name, fixtures), 'utf8');

/** The fixture names, for tests that cover all of them. */
export const FIXTURES = ['theme.lino', 'site.lino', 'user.lino'];

/** The sample document (`app`) with the sample theme (`material3`). */
export const appDocument = () =>
  parse(sample('document.lino') + sample('tokens.lino'));

/** The `code` of the error `fn` throws, or `undefined` if it does not. */
export function errorCode(fn) {
  try {
    fn();
  } catch (error) {
    return error.code ?? error.name;
  }
  return undefined;
}

/** A config listener that records every call. */
export function recorded(config) {
  const calls = [];
  config.subscribe((events) => calls.push(events));
  return calls;
}

/** An in-memory `Storage` stub. */
export function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => void data.set(key, String(value)),
    removeItem: (key) => void data.delete(key),
  };
}
