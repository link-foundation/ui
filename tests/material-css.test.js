import { it } from 'node:test';
import assert from 'node:assert/strict';
import { transform } from 'esbuild';
import { buildCss } from '@link-foundation/ui-dom';
import { loadTheme } from '@link-foundation/ui-themes';

it('HIG material selectors and theme-root alternatives minify without CSS syntax warnings', async () => {
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
