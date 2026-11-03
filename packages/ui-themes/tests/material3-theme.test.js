import process from 'node:process';
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { loadTheme } from '../src/index.js';
import {
  compileThemeCss,
  contrastRatio,
  resolveThemeTokens,
} from '@link-foundation/ui-tokens/themes';

it('loads Material 3 without errors and every pair passes in every scheme', async () => {
  const theme = await loadTheme('material3');
  assert.deepEqual(theme.diagnostics, []);
  assert.equal(
    resolveThemeTokens(theme).get('color.primary').m3,
    'md.sys.color.primary'
  );
  for (const modes of [
    [],
    ['dark'],
    ['high-contrast'],
    ['dark', 'high-contrast'],
  ]) {
    const tokens = resolveThemeTokens(theme, modes);
    for (const [on, fill] of theme.pairs) {
      assert.ok(
        contrastRatio(tokens.get(on).value, tokens.get(fill).value) >= 4.5,
        `${modes}: ${on}/${fill}`
      );
    }
  }
  for (const role of ['display', 'headline', 'title', 'body', 'label']) {
    for (const size of ['large', 'medium', 'small']) {
      assert.equal(theme.tokens.get(`type.${role}.${size}`).type, 'typography');
    }
  }
  for (const kind of [
    'button',
    'text-field',
    'checkbox',
    'radio',
    'switch',
    'slider',
  ]) {
    assert.ok(theme.templates.has(kind));
  }
  const diagnostics = [];
  const css = compileThemeCss(theme, { diagnostics, strict: true });
  assert.deepEqual(diagnostics, []);
  assert.ok(css.includes('forced-colors'));
  assert.ok(css.includes(':focus-visible'));
});
it('does not install Material Web, MUI, Roboto or Material Symbols font packages', () => {
  const tree = JSON.parse(
    execFileSync(
      process.platform === 'win32' ? 'npm.cmd' : 'npm',
      [
        'ls',
        '--workspace',
        '@link-foundation/ui-themes',
        '--all',
        '--json',
        '--package-lock-only',
      ],
      {
        encoding: 'utf8',
        maxBuffer: 8 * 1024 * 1024,
        shell: process.platform === 'win32',
      }
    )
  );
  const visit = (node) => {
    for (const [name, dep] of Object.entries(node.dependencies ?? {})) {
      assert.ok(
        !/^(@material\/web|@mui\/|.*(?:fontsource|font)\/(?:roboto|material-symbols))/u.test(
          name
        ),
        name
      );
      visit(dep);
    }
  };
  visit(tree);
});
