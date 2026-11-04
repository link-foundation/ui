import { it } from 'node:test';
import assert from 'node:assert/strict';
import postcss from 'postcss';
import { transform } from 'esbuild';
import { readStyles, compileCss } from '../src/index.js';

for (const scope of [undefined, ':scope', '[data-theme="hig"]']) {
  for (const part of ['', '    part indicator\n']) {
    it(`material selectors preserve states and parts with scope ${scope} and part ${Boolean(part)}`, async () => {
      const { rules, diagnostics } = readStyles(`glass: style
  selector
    type checkbox
${part}  material regular
  state hover
    material thin
  state pressed
    material thick
  state disabled
    material regular
  state checked
    material thin
  state focus
    material thick
  media
    min-width 640px
    material thin
`);
      assert.deepEqual(diagnostics, []);
      const css = compileCss(rules, {
        scope,
        tagFor: (kind) => `[data-kind='${kind}']`,
      });
      const opaque = [];
      const translucent = [];
      postcss.parse(css).walkRules((rule) => {
        if (rule.nodes.some((node) => node.prop === 'backdrop-filter')) {
          translucent.push(rule.selector);
        } else {
          opaque.push(rule.selector);
        }
      });
      assert.equal(opaque.length, 7);
      assert.deepEqual(
        translucent,
        opaque.map(
          (selector) =>
            `:is(${selector}):not([data-transparency="off"], [data-transparency="off"] *)`
        )
      );
      assert.doesNotMatch(css, /\]true/u);
      const result = await transform(css, { loader: 'css', minify: true });
      assert.deepEqual(result.warnings, []);
    });
  }
}

it('material within selectors retain the ancestor scope-root alternative and conditions', () => {
  const { rules, diagnostics } = readStyles(`glass: style
  selector
    type stack
    within
      type dialog
  media
    min-width 640px
    material thin
`);
  assert.deepEqual(diagnostics, []);
  const css = compileCss(rules, { scope: ':scope' });
  assert.ok(
    css.includes(
      ':is(ui-dialog ui-stack, :where(:scope):is(ui-dialog) ui-stack):not('
    )
  );
  const root = postcss.parse(css);
  root.walkDecls('backdrop-filter', (decl) => {
    const conditions = [];
    for (let p = decl.parent.parent; p.type === 'atrule'; p = p.parent) {
      conditions.push(p.params);
    }
    assert.deepEqual(conditions, [
      '(backdrop-filter: blur(1px))',
      '(prefers-reduced-transparency: no-preference) and (forced-colors: none)',
      '(min-width: 640px)',
    ]);
  });
});
