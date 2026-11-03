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
    ':where([data-theme="base"])',
  ]) {
    assert.ok(css.includes(text), text);
  }
  assert.ok(!css.includes('!important'));
});
