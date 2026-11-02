/**
 * Shared helpers of the ui-style tests: the issue-1 samples, the fixtures
 * and the golden files.
 *
 * Golden files are compared byte for byte. To rewrite them after a wanted
 * change of `compileCss`: `UPDATE_GOLDEN=1 node --test packages/ui-style/tests/`
 * and review the diff.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@link-foundation/ui-core';
import { readTokens, resolveTokens } from '@link-foundation/ui-tokens';
import { readStyles } from '@link-foundation/ui-style';

const here = dirname(fileURLToPath(import.meta.url));

export const REPO = join(here, '..', '..', '..');
export const SAMPLES = join(REPO, 'docs', 'case-studies', 'issue-1', 'samples');
export const FIXTURES = join(here, 'fixtures');
export const GOLDEN = join(here, 'golden');

const read = (file) => readFileSync(file, 'utf8');

/** The rules of samples/styles.lino (one rule, `button-style`). */
export const sampleStyles = () =>
  readStyles(read(join(SAMPLES, 'styles.lino')));

/** The rules of a fixture of tests/fixtures. */
export const fixtureStyles = (name) => readStyles(read(join(FIXTURES, name)));

/** samples/tokens.lino resolved for the set `material3`. */
export function sampleTokens() {
  const { sets } = readTokens(read(join(SAMPLES, 'tokens.lino')));
  return resolveTokens(sets, 'material3');
}

/** samples/document.lino: the document and the element `ok` with ancestors. */
export function sampleDocument() {
  const doc = parse(read(join(SAMPLES, 'document.lino')));
  const app = doc.byId.get('app');
  const body = doc.byId.get('body');
  return { doc, app, body, ok: doc.byId.get('ok'), okAncestors: [app, body] };
}

/** An element for matching tests. */
export const node = (kind, id = null, props = {}) => ({
  id,
  kind,
  positional: [],
  properties: Object.entries(props).map(([name, value]) => ({
    name,
    values: [value],
  })),
  children: [],
  unknown: [],
});

/** The content of a golden file; rewritten first when UPDATE_GOLDEN is set. */
export function golden(name, actual) {
  const file = join(GOLDEN, name);
  if (globalThis.process?.env?.UPDATE_GOLDEN) {
    writeFileSync(file, actual);
  }
  return read(file);
}

export const codes = (diagnostics) => diagnostics.map((d) => d.code);
