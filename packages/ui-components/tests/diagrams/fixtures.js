/**
 * The shared diagram fixtures of tests/diagrams/fixtures/: every `.lino`
 * file, read as text, and the expected Mermaid output of the login flow.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { URL } from 'node:url';

const DIR = new URL('./fixtures/', import.meta.url);

/** @returns {{name: string, text: string}[]} every `.lino` fixture */
export function linoFixtures() {
  return readdirSync(DIR)
    .filter((name) => name.endsWith('.lino'))
    .sort()
    .map((name) => ({ name, text: readFileSync(new URL(name, DIR), 'utf8') }));
}

/** @param {string} name a fixture file name */
export const fixture = (name) => readFileSync(new URL(name, DIR), 'utf8');
