/* global URL */
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readTokens, resolveTokens, toCss } from '../src/index.js';
import { loadThemes, compileThemeCss } from '../src/themes/index.js';

const fixture = () =>
  readFileSync(
    new URL('./fixtures/optical-palettes.lino', import.meta.url),
    'utf8'
  );
it('exports an original twelve palette by two mode pack with scoped channels', () => {
  const { sets, diagnostics } = readTokens(fixture());
  assert.deepEqual(diagnostics, []);
  const pack = new Map(
    [...sets.keys()].map((id) => [id, resolveTokens(sets, id)])
  );
  const css = toCss(pack, { pack: true, channels: true });
  for (const id of sets.keys()) {
    assert.ok(css.includes(`[data-palette="${id}"]`));
    for (const mode of ['dark', 'light']) {
      assert.ok(
        css.includes(`[data-palette="${id}"]:is([data-mode="${mode}"])`)
      );
    }
  }
  assert.match(css, /--color-surface-rgb: 18 36 54;/u);
  assert.doesNotMatch(toCss(pack, { pack: true }), /-rgb:/u);
  const themes = loadThemes(fixture()).themes;
  const compiled = compileThemeCss(themes, { channels: true });
  assert.match(compiled, /data-palette="original-12"/u);
  assert.match(compiled, /--color-surface-rgb:/u);
});
