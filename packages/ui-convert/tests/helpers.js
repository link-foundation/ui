/**
 * Shared helpers of the ui-convert tests: the interop fixtures and the
 * LiNo stability check.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format, parse } from '@link-foundation/ui-core';
import { interopVocabulary } from '../src/interop/index.js';

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
