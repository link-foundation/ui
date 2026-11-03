import { it } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadThemes,
  resolveTheme,
  resolveTemplate,
} from '../src/themes/index.js';
import { loadTheme } from '../../ui-themes/src/index.js';

it('selects the last theme template for button and returns null for missing kinds', async () => {
  const base = await loadTheme('base');
  assert.equal(resolveTemplate([base], 'button').name, 'root');
  assert.equal(resolveTemplate([base], 'text'), null);
  assert.equal(
    resolveTemplate(
      [base, { templates: new Map([['button', { name: 'replacement' }]]) }],
      'button'
    ).name,
    'replacement'
  );
});
it('diagnoses unknown and duplicate parts, including nested parts', () => {
  for (const part of ['unknown', 'root']) {
    const result = loadThemes(
      `x: theme\n  template button\n    part root\n      kind box\n    part ${part}\n      kind text`
    );
    assert.ok(result.diagnostics.some((d) => d.code === 'unknown-part'));
    assert.equal(result.themes[0].templates.size, 0);
  }
});
it('inherits templates through the real theme chain', async () => {
  const base = await loadTheme('base');
  const child = loadThemes('child: theme\n  extends base').themes[0];
  const theme = resolveTheme(
    new Map([
      ['base', base.chain[0]],
      ['child', child],
    ]),
    'child'
  );
  assert.deepEqual(
    resolveTemplate(theme, 'button'),
    resolveTemplate(base, 'button')
  );
});
it('rejects malformed and nested unknown parts without throwing', () => {
  for (const text of [
    'x: theme\n  template button\n    part label\n      part root',
    'x: theme\n  template button\n    part root\n      part unknown\n    part label',
    'x: theme\n  template button\n    part root',
  ]) {
    const result = loadThemes(text);
    assert.equal(result.themes[0].templates.size, 0);
    assert.ok(result.diagnostics.some((d) => d.severity === 'error'));
  }
});
