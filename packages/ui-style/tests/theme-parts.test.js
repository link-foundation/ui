import { it } from 'node:test';
import assert from 'node:assert/strict';
import { readStyles, compileCss } from '../src/index.js';
it('targets native control parts and applies focus states to the part', () => {
  const { rules, diagnostics } = readStyles(`focus: style
  selector
    type button
    variant filled
    part root
  state focus
    outline-width 2px
    outline-style solid
    outline-offset 2px
    outline-color
      token color.on-surface`);
  assert.deepEqual(diagnostics, []);
  const css = compileCss(rules);
  assert.ok(
    css.includes("ui-button[variant='filled'] [data-part='root']:focus-visible")
  );
  const scoped = compileCss(rules, { scope: '[data-theme="fluent2"]' });
  assert.ok(
    scoped.includes(
      ":is(ui-button[variant='filled']) [data-part='root']:focus-visible"
    )
  );
  for (const declaration of [
    'outline-width: 2px',
    'outline-style: solid',
    'outline-offset: 2px',
    'outline-color: var(--color-on-surface)',
  ]) {
    assert.ok(css.includes(declaration));
  }
});
it('applies interaction states on the host to its visual parts', () => {
  const { rules } = readStyles(`style
  selector
    type checkbox
    part indicator
  state hover
    border-color '#000000'
  state disabled
    background '#ffffff'
  state checked
    background '#000000'`);
  const css = compileCss(rules);
  assert.ok(css.includes('ui-checkbox:hover:not(:is([disabled]'));
  assert.ok(
    css.includes(
      "ui-checkbox:has([data-part='input']:is(:checked, [aria-checked='true'])) [data-part='indicator']"
    )
  );
  assert.ok(
    css.includes(
      "ui-checkbox:is([disabled], [aria-disabled='true'], :has([data-part='input']:disabled), :has([data-part='thumb'][aria-disabled='true'])) [data-part='indicator']"
    )
  );
});
