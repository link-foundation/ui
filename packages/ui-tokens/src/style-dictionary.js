/**
 * `buildWithStyleDictionary(resolved, config)`: run Style Dictionary
 * (https://styledictionary.com) on the tokens, for the platforms this
 * package does not write itself (Android XML, SCSS, Flutter, ...).
 *
 * The tokens are written as a DTCG 2025.10 file (`toDtcg`) to a temporary
 * directory, which becomes the `source` of the Style Dictionary config;
 * the directory is removed afterwards. Only the tokens of `resolved` are
 * written, not the other modes: Style Dictionary has none, so a mode is
 * built from `resolveTokens(sets, id, { mode })`. `style-dictionary` is an optional
 * peer dependency: it is imported only here, only when called, and only
 * when no `StyleDictionary` class is given.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { toDtcg } from './export/dtcg.js';

/** @typedef {import('./types.js').ResolvedTokens} ResolvedTokens */

async function loadStyleDictionary() {
  try {
    return (await import('style-dictionary')).default;
  } catch (error) {
    throw new Error(
      'buildWithStyleDictionary needs the optional peer dependency style-dictionary: npm install --save-dev style-dictionary',
      { cause: error }
    );
  }
}

/**
 * Build the tokens with Style Dictionary.
 * @param {ResolvedTokens} resolved
 * @param {Record<string, any>} config  a Style Dictionary config without
 *   `source` (it is set to the generated token file): `{ platforms: {
 *   scss: { transformGroup: 'scss', buildPath: 'out/', files: [...] } } }`
 * @param {{ StyleDictionary?: any, keepAliases?: boolean }} [options]
 *   `StyleDictionary` is the class to use (default: the installed
 *   `style-dictionary`); `keepAliases` is passed to `toDtcg`
 * @returns {Promise<any>} the Style Dictionary instance after the build
 */
export async function buildWithStyleDictionary(
  resolved,
  config,
  { StyleDictionary, keepAliases = true } = {}
) {
  const SD = StyleDictionary ?? (await loadStyleDictionary());
  const dir = await mkdtemp(join(tmpdir(), 'link-ui-tokens-'));
  try {
    const source = join(dir, 'tokens.json');
    // Style Dictionary has no modes and reads a root $extensions as a
    // group of tokens; build a mode from tokens resolved with `{ mode }`.
    const tokens = toDtcg(resolved, { keepAliases });
    delete tokens.$extensions;
    await writeFile(source, `${JSON.stringify(tokens, null, 2)}\n`);
    const sd = new SD({ ...config, source: [source] });
    await sd.buildAllPlatforms();
    return sd;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
