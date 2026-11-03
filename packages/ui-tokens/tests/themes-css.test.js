/* global URL */
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadTheme } from '../../ui-themes/src/index.js';
import { compileThemeCss } from '../src/themes/compile-css.js';

it('matches the base CSS snapshot with every preference, scoped styles and no important', async () => {
  const css = compileThemeCss(await loadTheme('base'));
  assert.equal(
    css,
    readFileSync(new URL('./golden/base-theme.css', import.meta.url), 'utf8')
  );
  for (const text of [
    'data-scheme="dark"',
    'prefers-color-scheme: dark',
    'data-contrast="more"',
    'prefers-contrast: more',
    'forced-colors: active',
    'CanvasText',
    'ButtonText',
    'Highlight',
    'data-motion="reduced"',
    'prefers-reduced-motion: reduce',
    '@scope ([data-theme="base"]) to ([data-theme])',
  ]) {
    assert.ok(css.includes(text), text);
  }
  assert.ok(!css.includes('!important'));
});
it('inherits validated system-color mappings for namespaced aliases', async () => {
  const { loadThemes, resolveTheme } = await import('../src/themes/model.js');
  const { themes, diagnostics } = loadThemes(`parent: theme
  token custom.foreground '#ffffff'
  forced-color custom.foreground CanvasText
child: theme
  extends parent
  forced-color custom.foreground HighlightText`);
  assert.deepEqual(diagnostics, []);
  const theme = resolveTheme(new Map(themes.map((t) => [t.id, t])), 'child');
  assert.equal(theme.forcedColors.get('custom.foreground'), 'HighlightText');
  assert.ok(
    compileThemeCss(theme).includes('--custom-foreground: HighlightText;')
  );
  assert.ok(
    loadThemes(
      "invalid: theme\n  forced-color 'x;}body{color:red' CanvasText"
    ).diagnostics.some((d) => d.code === 'invalid-forced-color')
  );
  assert.equal(
    loadThemes('invalid: theme\n  forced-color x url(bad)').diagnostics[0].code,
    'invalid-forced-color'
  );
});
