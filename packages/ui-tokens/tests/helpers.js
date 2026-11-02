/**
 * Shared helpers of the ui-tokens tests: the token files, the golden files
 * and a comparable form of resolved tokens.
 *
 * Golden files are compared byte for byte. To rewrite them after a wanted
 * change of an exporter: `UPDATE_GOLDEN=1 node --test packages/ui-tokens/tests/`
 * and review the diff.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readTokens, resolveTokens } from '@link-foundation/ui-tokens';

const here = dirname(fileURLToPath(import.meta.url));

export const REPO = join(here, '..', '..', '..');
export const PACKAGE = join(here, '..');
export const GOLDEN = join(here, 'golden');
/** The token sample of the issue-1 case study (one set, `material3`). */
export const SAMPLE = join(
  REPO,
  'docs',
  'case-studies',
  'issue-1',
  'samples',
  'tokens.lino'
);
/** Two sets with aliases, modes, a shadow and a typography (`brand`). */
export const FULL = join(here, 'fixtures', 'full.lino');

/** Read and resolve one set of a token file. */
export function load(file, setId, options) {
  const { sets, diagnostics } = readTokens(readFileSync(file, 'utf8'));
  return { sets, diagnostics, resolved: resolveTokens(sets, setId, options) };
}

export const sample = () => load(SAMPLE, 'material3').resolved;
export const full = () => load(FULL, 'brand').resolved;

/** Resolve the tokens of a Links Notation text. */
export function resolveText(text, setId, options) {
  const { sets } = readTokens(text);
  return resolveTokens(sets, setId, options);
}

/** The content of a golden file; rewritten first when UPDATE_GOLDEN is set. */
export function golden(name, actual) {
  const file = join(GOLDEN, name);
  if (globalThis.process?.env?.UPDATE_GOLDEN) {
    writeFileSync(file, actual);
  }
  return readFileSync(file, 'utf8');
}

/**
 * What a token resolves to, without where it was defined (`set`, `mode`):
 * the tokens sorted by path.
 */
export const comparable = (tokens) =>
  [...tokens.values()]
    .map(({ path, type, value, raw, alias, description }) => ({
      path,
      type,
      value,
      raw,
      ...(alias === undefined ? {} : { alias }),
      ...(description === undefined ? {} : { description }),
    }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

export const codes = (diagnostics) => diagnostics.map((d) => d.code);
