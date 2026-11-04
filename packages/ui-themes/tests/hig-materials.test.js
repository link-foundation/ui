import { it } from 'node:test';
import assert from 'node:assert/strict';
import { compileThemeCss } from '@link-foundation/ui-tokens/themes';
import { loadTheme } from '../src/index.js';
import { readStyles, compileCss } from '@link-foundation/ui-style';

it('all three materials compile through style rules with an opaque, supported-only fallback', async () => {
  const theme = await loadTheme('hig');
  const css = compileThemeCss(theme);
  for (const name of ['regular', 'thin', 'thick']) {
    assert.match(css, new RegExp(`material-${name}-blur`, 'u'));
    assert.match(css, /background-color: var\(--color-surface\)/u);
  }
  assert.match(css, /@media \(prefers-reduced-transparency: no-preference\)/u);
  assert.match(css, /@supports \(backdrop-filter: blur\(1px\)\)/u);
  assert.match(css, /:not\(\[data-transparency="off"\]/u);
  for (const options of [
    { transparency: 'off' },
    { reducedTransparency: true },
  ]) {
    const compiled = compileThemeCss(theme, options);
    assert.doesNotMatch(compiled, /backdrop-filter/u);
    assert.match(compiled, /background-color: var\(--color-surface\)/u);
  }
});

it('material accepts only the three declared enums and preserves token prefixes', () => {
  const { rules, diagnostics } = readStyles(
    'glass: style\n  selector\n    type stack\n  material thin\n'
  );
  assert.deepEqual(diagnostics, []);
  assert.match(
    compileCss(rules, { prefix: 'brand' }),
    /var\(--brand-material-thin-blur\)/u
  );
  assert.ok(
    readStyles(
      'bad: style\n  selector\n    type stack\n  material unsafe\n'
    ).diagnostics.some((d) => d.severity === 'error')
  );
});

it('HIG material selectors and theme-root alternatives minify without CSS syntax warnings', async () => {
  const { buildCss } = await import('@link-foundation/ui-dom');
  const { transform } = await import('esbuild');
  const css = buildCss({
    themeRegistry: new Map([['hig', await loadTheme('hig')]]),
  });
  assert.doesNotMatch(css, /\]true/u);
  for (const material of ['regular', 'thin', 'thick']) {
    assert.ok(
      css.includes(
        `:is([material='${material}'], :where(:scope):is([material='${material}'])):not(`
      )
    );
  }
  const result = await transform(css, { loader: 'css', minify: true });
  assert.deepEqual(
    result.warnings.filter((warning) => warning.id === 'css-syntax-error'),
    []
  );
});
