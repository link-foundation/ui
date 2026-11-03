/* global URL */
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadThemes } from '@link-foundation/ui-tokens/themes';
import { loadTheme } from '../src/index.js';
import { classicThemes } from '../src/classic/catalog.js';

it('every skin explicitly covers every base semantic token, in light and dark', async () => {
  const base = await loadTheme('base');
  const skins = classicThemes.filter(
    (t) =>
      ['deepcase', 'konard', 'meta-sovereign'].includes(t.family) ||
      t.id.startsWith('fa-') ||
      t.id.startsWith('immortality-')
  );
  for (const { id, path } of skins) {
    const text = await readFile(
      new URL(`../themes/${path}`, import.meta.url),
      'utf8'
    );
    const raw = loadThemes(text).themes.find((t) => t.id === id);
    for (const key of base.tokens.keys()) {
      assert.ok(raw.tokens.has(key), `${id}: ${key}`);
      assert.ok(raw.modes.dark.has(key), `${id} dark: ${key}`);
    }
  }
});

it('historical radii, opacity and reduced effects survive resolution', async () => {
  for (const [id, radius] of [
    ['chat-t3', 14],
    ['chat-telegram', 15],
    ['chat-whatsapp', 7.5],
    ['chat-signal', 18],
  ]) {
    assert.equal(
      (await loadTheme(id)).tokens.get('bubble.radius').value,
      radius
    );
  }
  assert.equal(
    (await loadTheme('fa-glass')).tokens.get('surface.opacity').value,
    0.78
  );
  for (const id of ['poseidon', 'arwes', 'quiet']) {
    const theme = await loadTheme(id);
    for (const effect of ['glow', 'scanline', 'flicker']) {
      assert.equal(theme.modes.reduced.get(`effect.${effect}`).value, 0);
    }
  }
});
