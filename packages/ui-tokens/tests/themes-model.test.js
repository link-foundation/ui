import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadThemes, resolveTheme } from '../src/themes/model.js';

const registry = (text) =>
  new Map(loadThemes(text).themes.map((t) => [t.id, t]));

describe('theme model', () => {
  it('resolves depth-three inheritance, modes and aliases through ui-tokens', () => {
    const themes = registry(`a: theme
  token color.primary '#000000'
  token color.alias
    token color.primary
  mode dark
    token color.primary '#FFFFFF'
b: theme
  extends a
  token space.small 4px
c: theme
  extends b
  token color.primary '#123456'`);
    const theme = resolveTheme(themes, 'c');
    assert.equal(theme.tokens.get('color.primary').r, 0x12 / 255);
    assert.equal(theme.tokens.get('color.alias').r, 0x12 / 255);
    assert.equal(theme.modes.dark.get('color.primary').r, 0x12 / 255);
    assert.deepEqual(theme.diagnostics, []);
  });
  it('reports cycles and missing parents without crashing', () => {
    const themes = registry(
      'a: theme\n  extends b\nb: theme\n  extends a missing'
    );
    const result = resolveTheme(themes, 'a');
    assert.ok(result.diagnostics.some((d) => d.code === 'extends-cycle'));
    assert.ok(result.diagnostics.some((d) => d.code === 'unknown-set'));
  });
  it('rejects executable content anywhere with one diagnostic per rejection', () => {
    const { themes, diagnostics } = loadThemes(`bad: theme
  token font.body 'JAVASCRIPT:alert(1)'
  mode dark
    token font.body 'expression(alert(1))'
  template button
    part root
      script boom
  script boom`);
    assert.equal(
      diagnostics.filter((d) => d.code === 'unsafe-theme').length,
      4
    );
    assert.equal(themes[0].tokens.size, 0);
    assert.equal(themes[0].templates.size, 0);
  });
});
