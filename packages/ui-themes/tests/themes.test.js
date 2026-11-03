import { it } from 'node:test';
import assert from 'node:assert/strict';
import { listThemes, loadTheme } from '../src/index.js';

it('loads every shipped theme as data with a dark mode', async () => {
  assert.deepEqual(listThemes(), ['base']);
  for (const id of listThemes()) {
    const theme = await loadTheme(id);
    assert.equal(theme.id, id);
    assert.ok(theme.modes.dark.size > 0);
    assert.deepEqual(theme.diagnostics, []);
  }
  await assert.rejects(loadTheme('../other'), RangeError);
});
