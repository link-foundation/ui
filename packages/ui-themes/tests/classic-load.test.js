/* global URL */
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { parseNested } from '@link-foundation/ui-core';
import { loadThemes, compileThemeCss } from '@link-foundation/ui-tokens/themes';
import { listThemes, loadTheme } from '../src/index.js';

it('every classic LiNo file parses and every registered theme compiles strictly in every mode combination', async () => {
  const root = new URL('../themes/classic/', import.meta.url);
  const files = await readdir(root, { recursive: true });
  assert.ok(files.filter((f) => f.endsWith('.lino')).length >= 25);
  for (const file of files.filter((f) => f.endsWith('.lino'))) {
    const text = await readFile(new URL(file, root), 'utf8');
    assert.ok(parseNested(text).length, file);
    assert.deepEqual(loadThemes(text).diagnostics, [], file);
  }
  assert.ok(listThemes().includes('deepcase-classic'));
  for (const id of listThemes().filter((id) => id !== 'base')) {
    const theme = await loadTheme(id);
    assert.deepEqual(theme.diagnostics, [], id);
    const diagnostics = [];
    const css = compileThemeCss(theme, { strict: true, diagnostics });
    assert.deepEqual(diagnostics, [], id);
    assert.ok(theme.modes.dark.size > 0, id);
    assert.ok(css.includes('forced-colors'), id);
  }
});
