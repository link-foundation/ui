import { it } from 'node:test';
import assert from 'node:assert/strict';
import { loadTheme } from '../../ui-themes/src/index.js';
import { contrastRatio, ensureContrast } from '../src/themes/contrast.js';
import {
  compileThemeCss,
  loadThemes,
  resolveTheme,
} from '../src/themes/index.js';

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
