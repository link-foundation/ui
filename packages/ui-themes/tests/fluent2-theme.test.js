import { URL } from 'node:url';
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { loadTheme } from '../src/index.js';
import {
  compileThemeCss,
  contrastRatio,
} from '@link-foundation/ui-tokens/themes';

it('loads Fluent with unchanged accessible pairs in all schemes', async () => {
  const theme = await loadTheme('fluent2');
  assert.deepEqual(theme.diagnostics, []);
  for (const tokens of [
    theme.tokens,
    theme.modes.dark,
    theme.modes['high-contrast'],
  ]) {
    for (const [fg, bg, min = 4.5] of theme.pairs) {
      assert.ok(
        contrastRatio(tokens.get(fg), tokens.get(bg)) >= min,
        `${fg}/${bg}`
      );
    }
  }
  const diagnostics = [];
  const css = compileThemeCss(theme, { strict: true, diagnostics });
  assert.deepEqual(diagnostics, []);
  assert.ok(css.includes('CanvasText'));
  assert.equal(theme.templates.size, 7);
});

it('preserves every source alias and original value, and regenerates deterministically', async () => {
  const { webLightTheme, webDarkTheme, teamsHighContrastTheme } =
    await import('@fluentui/tokens');
  const { generateFluent2 } = await import('../scripts/generate-fluent2.mjs');
  const { mkdtemp, readFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { pathToFileURL } = await import('node:url');
  const { join } = await import('node:path');
  const theme = await loadTheme('fluent2');
  for (const [mode, source] of [
    ['light', webLightTheme],
    ['dark', webDarkTheme],
    ['high-contrast', teamsHighContrastTheme],
  ]) {
    const rows = theme.chain.flatMap((t) =>
      mode === 'light'
        ? t.set.tokens
        : [...t.set.tokens, ...(t.set.modes[mode] ?? [])]
    );
    const rebuilt = Object.fromEntries(
      rows
        .filter((t) => t.fluent)
        .map((t) => [
          t.fluent,
          typeof source[t.fluent] === 'number'
            ? Number(t.sourceValue)
            : t.sourceValue,
        ])
    );
    assert.deepEqual(rebuilt, source);
  }
  const dir = await mkdtemp(join(tmpdir(), 'fluent2-'));
  try {
    const url = pathToFileURL(`${dir}/`);
    const aliasFile = new URL('aliases.js', url);
    const one = await generateFluent2(url, aliasFile);
    const aliases = await readFile(aliasFile, 'utf8');
    const two = await generateFluent2(url, aliasFile);
    assert.equal(await readFile(aliasFile, 'utf8'), aliases);
    assert.equal(
      aliases,
      await readFile(
        new URL('../src/fluent2/brand-aliases.js', import.meta.url),
        'utf8'
      )
    );
    assert.deepEqual(one, two);
    for (const [name, text] of one) {
      assert.equal(
        text,
        await readFile(
          new URL(`../themes/fluent2/${name}`, import.meta.url),
          'utf8'
        ),
        name
      );
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
