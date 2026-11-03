/* global URL */
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readStyles, compileCss } from '@link-foundation/ui-style';
import { frameStyle, corners, lines } from '../src/classic/frames.js';

it('all 35 frames match the reviewed LiNo snapshot and share one opacity layer', async () => {
  const frames = [];
  for (const corner of corners) {
    for (const line of lines) {
      const text = frameStyle({ corner, line, size: 12 });
      const result = readStyles(text);
      assert.deepEqual(result.diagnostics, []);
      assert.equal(result.rules.length, 1);
      const css = compileCss(result.rules);
      assert.match(css, /clip-path:/u);
      assert.match(css, /border-radius: 0px/u);
      assert.equal((css.match(/opacity:/gu) ?? []).length, 1);
      assert.match(css, /opacity: var\(--surface-opacity\)/u);
      assert.doesNotMatch(css, /::before|::after/u);
      frames.push(text);
    }
  }
  assert.equal(
    frames.join('\n'),
    await readFile(
      new URL('./fixtures/classic-frames.lino', import.meta.url),
      'utf8'
    )
  );
  for (const size of [-1, 49, NaN, Infinity, '12']) {
    assert.throws(() => frameStyle({ size }), RangeError);
  }
  assert.throws(() => frameStyle({ corner: 'unknown' }), RangeError);
  assert.throws(() => frameStyle({ line: 'unknown' }), RangeError);
});
