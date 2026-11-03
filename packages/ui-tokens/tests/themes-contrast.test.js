import { it } from 'node:test';
import assert from 'node:assert/strict';
import { loadTheme } from '../../ui-themes/src/index.js';
import { contrastRatio, ensureContrast } from '../src/themes/contrast.js';
import {
  compileThemeCss,
  exportThemeResolver,
  loadThemes,
  resolveTheme,
} from '../src/themes/index.js';

it('propagates adjusted fills through alias chains in CSS and DTCG without changing the source', () => {
  const { themes } = loadThemes(`x: theme
  token color.on '#FFFFFF'
  token color.fill '#EEEEEE'
  token color.action
    token color.fill
  token color.button
    token color.action
  pair color.on color.fill`);
  const theme = resolveTheme(new Map(themes.map((t) => [t.id, t])), 'x');
  const css = compileThemeCss(theme);
  for (const context of Object.values(
    exportThemeResolver(theme).modifiers.mode.contexts
  )) {
    const colors = context[0].color;
    const fill = colors.fill.$value.hex;
    assert.ok(contrastRatio('#FFFFFF', fill) >= 4.5);
    for (const alias of ['action', 'button']) {
      assert.equal(colors[alias].$value.hex, fill);
      assert.ok(css.includes(`--color-${alias}: ${fill};`));
    }
  }
  assert.ok(
    contrastRatio(
      theme.tokens.get('color.on'),
      theme.tokens.get('color.fill')
    ) < 4.5
  );
});

it('has WCAG contrast 21 for white against black and adjusts failing accents', () => {
  assert.equal(contrastRatio('#FFFFFF', '#000000'), 21);
  for (const [on, fill] of [
    ['#FFFFFF', '#AABBCC'],
    ['#000000', '#112233'],
  ]) {
    const result = ensureContrast(on, fill);
    assert.equal(result.adjusted, true);
    assert.ok(result.ratio >= 4.5);
    assert.ok(contrastRatio(on, result.color) >= 4.5);
  }
});
it('reports a pair that aliases make unreachable after adjustment', () => {
  const { themes } = loadThemes(`x: theme
  token color.fill '#EEEEEE'
  token color.on
    token color.fill
  pair color.on color.fill`);
  const theme = resolveTheme(new Map(themes.map((t) => [t.id, t])), 'x');
  const diagnostics = [];
  compileThemeCss(theme, { diagnostics });
  assert.ok(
    diagnostics.some(
      (d) => d.code === 'contrast-unreachable' && d.severity === 'error'
    )
  );
});
it('every base pair passes in light, dark, and high contrast', async () => {
  const base = await loadTheme('base');
  for (const mode of [
    base.tokens,
    base.modes.dark,
    base.modes['high-contrast'],
  ]) {
    for (const [on, fill] of base.pairs) {
      assert.ok(contrastRatio(mode.get(on), mode.get(fill)) >= 4.5);
    }
  }
});
it('writes adjustments to compiled output and strict error diagnostics', () => {
  const { themes } = loadThemes(
    "x: theme\n  token color.on '#FFFFFF'\n  token color.fill '#EEEEEE'\n  pair color.on color.fill"
  );
  const theme = resolveTheme(new Map(themes.map((t) => [t.id, t])), 'x');
  for (const strict of [false, true]) {
    const diagnostics = [];
    const css = compileThemeCss(theme, { strict, diagnostics });
    assert.ok(!css.includes('--color-fill: #eeeeee;'));
    assert.ok(
      diagnostics.some(
        (d) =>
          d.code === 'contrast-adjusted' &&
          d.severity === (strict ? 'error' : 'warning')
      )
    );
  }
});

it('honors explicit non-text pair minimums and rejects invalid limits', () => {
  const { themes, diagnostics } = loadThemes(`x: theme
  token color.border '#888888'
  token color.surface '#FFFFFF'
  pair color.border color.surface
    min 3`);
  assert.deepEqual(diagnostics, []);
  const theme = resolveTheme(new Map(themes.map((t) => [t.id, t])), 'x');
  assert.deepEqual(theme.pairs, [['color.border', 'color.surface', 3]]);
  const reports = [];
  compileThemeCss(theme, { strict: true, diagnostics: reports });
  assert.deepEqual(reports, []);
  for (const limit of ['0', '22', 'NaN']) {
    const result = loadThemes(`x: theme\n  pair a b\n    min ${limit}`);
    assert.ok(result.diagnostics.some((d) => d.code === 'invalid-pair'));
  }
});
