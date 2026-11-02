/**
 * Shared helpers of the ui-convert tests: the interop fixtures and the
 * LiNo stability check.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format, parse } from '@link-foundation/ui-core';
import { Parser } from 'links-notation';
import { interopVocabulary } from '../src/interop/index.js';
import { componentVocabulary } from '../src/mappings/index.js';

const here = dirname(fileURLToPath(import.meta.url));

/** The package directory. */
export const PACKAGE_DIR = join(here, '..');
export const FIXTURES_DIR = join(here, 'fixtures', 'interop');

/** The text of a fixture, e.g. `fixtureText('lottie', 'dot-pulse.lino')`. */
export const fixtureText = (format, name) =>
  readFileSync(join(FIXTURES_DIR, format, name), 'utf8');

/** The parsed JSON of a fixture. */
export const fixture = (format, name) => JSON.parse(fixtureText(format, name));

/** The JSON fixture names of a format, minus `except`. */
export const fixtureNames = (format, except = []) =>
  readdirSync(join(FIXTURES_DIR, format))
    .filter((name) => name.endsWith('.json') && !except.includes(name))
    .sort();

/**
 * Parse LiNo with the interop vocabulary.
 * @param {string} lino
 */
export const parseLino = (lino) =>
  parse(lino, { vocabulary: interopVocabulary() });

/**
 * `serialize(parse(lino))` in the indented style the importers write.
 * @param {string} lino
 */
export const reformat = (lino) =>
  format(parseLino(lino), { style: 'indented' });

/** The codes of a diagnostics list. */
export const codes = (diagnostics) => diagnostics.map((d) => d.code);

/** The diagnostics of a list with severity `error`. */
export const errors = (diagnostics) =>
  diagnostics.filter((d) => d.severity === 'error');

/**
 * The JSX or Vue fixtures: `{ file, source, lino }`, where `lino` is the
 * expected output stored next to the source file.
 * @param {'jsx' | 'vue'} dir
 */
export const componentFixtures = (dir) => {
  const fixtures = join(here, dir, 'fixtures');
  return readdirSync(fixtures)
    .filter((file) => /\.(jsx|tsx|vue)$/.test(file))
    .sort()
    .map((file) => ({
      file,
      source: readFileSync(join(fixtures, file), 'utf8'),
      lino: readFileSync(
        join(fixtures, `${file.slice(0, file.lastIndexOf('.'))}.lino`),
        'utf8'
      ),
    }));
};

/**
 * Check that a component import parses with links-notation and with the
 * ui-core parser (component vocabulary) without errors.
 * @param {string} text
 */
export function expectParses(text) {
  const links = new Parser().parse(text);
  if (text.trim() !== '' && links.length === 0) {
    throw new Error(`links-notation read no links from:\n${text}`);
  }
  const tree = parse(text, { vocabulary: componentVocabulary() });
  const failed = tree.diagnostics.filter((d) => d.severity === 'error');
  if (failed.length > 0) {
    throw new Error(`ui-core errors: ${JSON.stringify(failed)}`);
  }
  return tree;
}
