/* global URL */
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadTheme } from '../src/index.js';
import {
  loadThemes,
  compileThemeCss,
  contrastRatio,
  resolveThemeTokens,
} from '@link-foundation/ui-tokens/themes';

for (const id of ['hig', 'hig-ios', 'hig-macos']) {
  it(`${id} loads without diagnostics and passes every pair in combined modes`, async () => {
    const theme = await loadTheme(id);
    assert.deepEqual(theme.diagnostics, []);
    for (const dark of [[], ['dark']]) {
      for (const contrast of [[], ['high-contrast']]) {
        for (const motion of [[], ['reduced']]) {
          const tokens = resolveThemeTokens(theme, [
            ...dark,
            ...contrast,
            ...motion,
          ]);
          assert.deepEqual(tokens.diagnostics, []);
          for (const [on, fill] of theme.pairs) {
            assert.ok(
              contrastRatio(tokens.get(on).value, tokens.get(fill).value) >=
                4.5,
              `${id}: ${on}/${fill}`
            );
          }
        }
      }
    }
    const diagnostics = [];
    assert.match(
      compileThemeCss(theme, { strict: true, diagnostics }),
      /linear\(/u
    );
    assert.deepEqual(diagnostics, []);
  });
}

it('variants override only the documented density allow-list', async () => {
  const base = await loadTheme('hig');
  const allowed = [
    'text.base.size',
    'size.control.height',
    'size.list-row.height',
  ];
  for (const id of ['hig-ios', 'hig-macos']) {
    const theme = await loadTheme(id);
    const changes = [...theme.tokens]
      .filter(
        ([key, value]) =>
          JSON.stringify(value) !== JSON.stringify(base.tokens.get(key))
      )
      .map(([key]) => key);
    assert.deepEqual(changes.sort(), [...allowed].sort());
    assert.equal(theme.tokens.size, base.tokens.size);
    assert.deepEqual(theme.pairs, base.pairs);
    assert.equal(theme.styles.length, base.styles.length);
    assert.deepEqual(theme.templates, base.templates);
  }
});

it('all eleven sizes are rem based, font stacks contain only system names, and all controls have templates', async () => {
  const theme = await loadTheme('hig');
  const sizes = [...theme.tokens].filter(
    ([key]) =>
      key.startsWith('text.') &&
      key.endsWith('.size') &&
      key !== 'text.base.size'
  );
  assert.equal(sizes.length, 11);
  for (const [, value] of sizes) {
    assert.equal(value.unit, 'rem');
  }
  assert.equal(
    theme.tokens.get('font.family.text').value,
    'system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
  );
  for (const kind of [
    'button',
    'switch',
    'text-field',
    'slider',
    'number-field',
    'radio-group',
    'select',
  ]) {
    assert.ok(theme.templates.has(kind));
  }
  for (const file of [
    'theme',
    'colors',
    'type',
    'shape',
    'spacing',
    'motion',
    'materials',
    'styles',
    'templates',
  ]) {
    const source = readFileSync(
      new URL(`../themes/hig/${file}.lino`, import.meta.url),
      'utf8'
    );
    assert.doesNotMatch(
      source,
      /sf-pro|sfsymbols|SF Symbols|https?:.*\.(?:woff2?|ttf|otf)/u
    );
  }
});

it('spring tokens preserve response/damping and reject malformed metadata without throwing', async () => {
  const theme = await loadTheme('hig');
  assert.deepEqual(theme.springs.default, { response: 0.35, damping: 0.85 });
  for (const value of [
    'spring response',
    'spring (response 0s) (damping 0.85)',
    'spring (response 0.35s) (damping 2)',
    'spring (response 0.35s) (response 0.5s)',
  ]) {
    const result = loadThemes(
      `bad: theme\n  token motion.spring.default (${value})`
    );
    assert.ok(result.diagnostics.some((d) => d.code === 'invalid-spring'));
  }
});
