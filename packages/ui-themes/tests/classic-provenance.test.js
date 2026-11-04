/* global URL */
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { classicThemes } from '../src/classic/catalog.js';

it('every pack has a source and licence row; konard code is independently implemented', async () => {
  const readme = await readFile(
    new URL('../themes/classic/README.md', import.meta.url),
    'utf8'
  );
  for (const { id, family } of classicThemes) {
    const row = readme
      .split('\n')
      .find((line) => line.startsWith(`| \`${id}\``));
    assert.ok(row, id);
    assert.match(row, /https:\/\/github.com\//u);
    assert.match(row, /ported|re-implemented/u);
    if (family === 'konard') {
      assert.match(row, /re-implemented, no code copied/u);
      assert.doesNotMatch(row, /ported/u);
    } else {
      assert.match(row, /Unlicense/u);
    }
  }
});
