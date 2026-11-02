/**
 * Shared helpers of the HTML importer tests: the fixtures and a jsdom
 * fragment of each one.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const here = dirname(fileURLToPath(import.meta.url));

export const FIXTURES_DIR = join(here, 'fixtures');

const read = (path) => readFileSync(path, 'utf8');

/**
 * Every fixture: `{ name, html, lino }`, where `lino` is the expected output
 * stored next to the HTML file.
 */
export const fixtures = () =>
  readdirSync(FIXTURES_DIR)
    .filter((file) => file.endsWith('.html'))
    .sort()
    .map((file) => {
      const name = file.slice(0, -'.html'.length);
      return {
        name,
        html: read(join(FIXTURES_DIR, file)),
        lino: read(join(FIXTURES_DIR, `${name}.lino`)),
      };
    });

/** The HTML as a jsdom `DocumentFragment` (the browser's `<template>` parse). */
export const domFragment = (html) => JSDOM.fragment(html);
