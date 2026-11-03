/**
 * Shared helpers of the icon tests: the repository root, a jsdom window,
 * and a temporary repository with the own icon set to build.
 */

import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { parseAssetRecords } from '../../../../scripts/lib/asset-records.mjs';

/** The repository root. */
export const ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../..'
);

export const read = (file) => readFileSync(file, 'utf8');

/** The asset records of assets/assets.lino. */
export const assetRecords = () =>
  parseAssetRecords(read(join(ROOT, 'assets/assets.lino')));

/** A fresh window with `<div id="app">` (custom elements never leak). */
export function createDom({ dir } = {}) {
  const dom = new JSDOM(
    `<!doctype html><html${dir ? ` dir="${dir}"` : ''}><head></head><body><div id="app"></div></body></html>`
  );
  const { window } = dom;
  return {
    window,
    document: window.document,
    container: window.document.getElementById('app'),
  };
}

/**
 * Run `body(root)` in a temporary repository: assets/icons/own/ and the own
 * icon records of the real one, plus `extra` files (path → text) and
 * `records` (assets.lino text) on top.
 */
export async function inFixture({ extra = {}, records = '' } = {}, body) {
  const root = mkdtempSync(join(tmpdir(), 'ui-icons-'));
  try {
    cpSync(join(ROOT, 'assets/icons/own'), join(root, 'assets/icons/own'), {
      recursive: true,
    });
    const own = read(join(ROOT, 'assets/assets.lino'))
      .split(/\n(?=\()/)
      .filter((block) => block.startsWith('(icon-'))
      .join('\n');
    writeFileSync(join(root, 'assets/assets.lino'), `${own}\n${records}`);
    for (const [file, text] of Object.entries(extra)) {
      mkdirSync(dirname(join(root, file)), { recursive: true });
      writeFileSync(join(root, file), text);
    }
    await body(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/** A small valid icon. */
export const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12h16"/></svg>\n';
