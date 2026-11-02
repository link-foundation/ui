/**
 * Shared helpers of the ui-core tests: the spec fixtures and the samples.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/** The repository root. */
export const REPO = join(here, '..', '..', '..');
export const FIXTURES_DIR = join(REPO, 'docs', 'spec', 'fixtures');
export const SAMPLES_DIR = join(
  REPO,
  'docs',
  'case-studies',
  'issue-1',
  'samples'
);
export const LOCAL_FIXTURES_DIR = join(here, 'fixtures');

export const read = (path) => readFileSync(path, 'utf8');

/**
 * Every spec fixture: `{ name, text, tree?, diagnostics? }` where `tree` is
 * the parsed `.tree.json` and `diagnostics` the parsed `.diagnostics.json`.
 */
export function specFixtures() {
  return readdirSync(FIXTURES_DIR).flatMap((area) =>
    readdirSync(join(FIXTURES_DIR, area))
      .filter((file) => file.endsWith('.lino'))
      .sort()
      .map((file) => {
        const base = join(FIXTURES_DIR, area, file.slice(0, -'.lino'.length));
        const json = (suffix) =>
          existsSync(base + suffix)
            ? JSON.parse(read(base + suffix))
            : undefined;
        return {
          name: `${area}/${file}`,
          text: read(`${base}.lino`),
          tree: json('.tree.json'),
          diagnostics: json('.diagnostics.json'),
        };
      })
  );
}

/** Every `.lino` sample of the issue-1 case study: `{ name, text }`. */
export const samples = () =>
  readdirSync(SAMPLES_DIR)
    .filter((file) => file.endsWith('.lino'))
    .sort()
    .map((file) => ({ name: file, text: read(join(SAMPLES_DIR, file)) }));

/** Diagnostics as sorted JSON strings: their order is not significant. */
export const sortedDiagnostics = (diagnostics) =>
  diagnostics
    .map(({ code, severity, at }) => JSON.stringify({ code, severity, at }))
    .sort();

/** The tree part of a document (everything but the diagnostics). */
export const shape = (doc) => ({ roots: doc.roots, unknown: doc.unknown });

/**
 * A deterministic pseudo-random generator (mulberry32) so random tests are
 * repeatable.
 * @param {number} seed
 */
export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The `#` comments of a Links Notation text, in order: the part of every
 * line that `stripComments` blanks, trimmed.
 * @param {string} text
 * @param {(text: string) => string} stripComments
 */
export function commentsOf(text, stripComments) {
  const stripped = stripComments(text);
  const found = [];
  let start = 0;
  while (start <= text.length) {
    let end = text.indexOf('\n', start);
    if (end === -1) {
      end = text.length;
    }
    for (let i = start; i < end; i++) {
      if (text[i] !== stripped[i]) {
        found.push(text.slice(i, end).trim());
        break;
      }
    }
    start = end + 1;
  }
  return found;
}

/** The `.lino` fixtures of the source edits: `{ name, text }`. */
export const sourceFixtures = () =>
  readdirSync(join(LOCAL_FIXTURES_DIR, 'source'))
    .filter((file) => file.endsWith('.lino'))
    .sort()
    .map((file) => ({
      name: file,
      text: read(join(LOCAL_FIXTURES_DIR, 'source', file)),
    }));
