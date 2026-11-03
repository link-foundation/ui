import { it } from 'node:test';
import assert from 'node:assert/strict';
import { formatLinks } from '@link-foundation/ui-core';
import { readStyles, compileCss } from '../src/index.js';

const rule = (declarations) =>
  formatLinks([
    {
      id: 'surface',
      values: ['style', ['selector', ['type', 'panel']], ...declarations],
    },
  ]);

it('surface effects and bounded frame geometry compile without executable CSS', () => {
  const result = readStyles(
    rule([
      ['surface-opacity', '0.78'],
      ['blur', '12px'],
      ['glow', '0'],
      ['scanline', '0'],
      ['clip-path', 'inset(0px round 12px)'],
      ['border-style', 'double'],
      ['stroke', '#123456'],
      ['arrow', 'triangle'],
    ])
  );
  assert.deepEqual(result.diagnostics, []);
  const css = compileCss(result.rules);
  assert.match(css, /color-mix\(in srgb, var\(--color-surface\)/u);
  assert.match(css, /backdrop-filter: blur\(12px\)/u);
  assert.match(css, /clip-path: inset\(0px round 12px\)/u);
  assert.match(css, /--graph-arrow: triangle/u);
  assert.doesNotMatch(css, /animation|steps\(/u);
  for (const declaration of [
    ['surface-opacity', '1.1'],
    ['blur', '-1px'],
    ['glow', '-1'],
    ['scanline', '2'],
    ['clip-path', 'url(https://example.com)'],
    ['clip-path', 'inset(0px);color:red'],
    ['arrow', 'url(evil)'],
  ]) {
    assert.ok(
      readStyles(rule([declaration])).diagnostics.length,
      declaration.join(' ')
    );
  }
});
