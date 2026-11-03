/* global URL */
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Parser } from 'links-notation';
import { values } from '@link-foundation/ui-core';
import { loadThemes, resolveTheme } from '@link-foundation/ui-tokens/themes';
import { loadTheme, muiThemeToLino } from '../src/index.js';

for (const name of ['light', 'dark', 'custom']) {
  it(`converts ${name} MUI fixture to a loadable theme`, async () => {
    const fixture = JSON.parse(
      await readFile(
        new URL(`./fixtures/mui-theme-${name}.json`, import.meta.url),
        'utf8'
      )
    );
    const { lino, unmapped } = muiThemeToLino(fixture);
    assert.ok(new Parser().parse(lino).length > 0);
    const base = await loadTheme('material3');
    const loaded = loadThemes(lino);
    assert.deepEqual(loaded.diagnostics, []);
    const theme = resolveTheme(
      new Map([...base.chain, ...loaded.themes].map((t) => [t.id, t])),
      'mui-import'
    );
    assert.deepEqual(theme.diagnostics, []);
    const tokens =
      fixture.palette.mode === 'dark' ? theme.modes.dark : theme.tokens;
    assert.equal(
      values.toCss(tokens.get('color.primary')).toLowerCase(),
      fixture.palette.primary.main.toLowerCase()
    );
    if (name === 'light') {
      for (const [path, expected] of [
        ['color.on-primary', '#ffffff'],
        ['color.secondary', '#9c27b0'],
        ['color.error', '#d32f2f'],
        ['color.warning', '#ed6c02'],
        ['color.info', '#0288d1'],
        ['color.success', '#2e7d32'],
        ['color.background', '#fafafa'],
        ['color.surface', '#ffffff'],
        ['color.on-surface', '#111111'],
        ['color.on-surface-variant', '#444444'],
        ['shape.corner.small', '4px'],
        ['space.unit', '8px'],
        ['breakpoint.xs', '0px'],
        ['breakpoint.xl', '1536px'],
        ['motion.duration.entering-screen', '225ms'],
      ]) {
        assert.equal(
          values.toCss(tokens.get(path)).toLowerCase(),
          expected,
          path
        );
      }
      assert.equal(tokens.get('type.font-family').type, 'fontFamily');
    }
    assert.deepEqual(
      unmapped,
      name === 'custom'
        ? [
            'components.MuiButton.defaultProps.disableRipple',
            'palette.primary.light',
            'spacing',
            'unknown',
          ]
        : []
    );
  });
}
it('reports unsupported values, empty objects, functions and nested array paths without executing them', () => {
  const result = muiThemeToLino({
    spacing: () => {
      throw new Error('executed');
    },
    palette: { mode: 'sepia' },
    typography: { h1: {} },
    list: [1, 2],
  });
  assert.deepEqual(result.unmapped, [
    'list',
    'palette.mode',
    'spacing',
    'typography.h1',
  ]);
  assert.throws(() => muiThemeToLino(null), TypeError);
});
