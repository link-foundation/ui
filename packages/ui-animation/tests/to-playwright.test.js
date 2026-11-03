import { URL } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toPlaywright } from '../src/index.js';

test('generated literals escape script boundaries and Unicode line separators', () => {
  const value = '</script>\u2028\u2029';
  const spec = toPlaywright({
    id: 'hostile-values',
    events: [{ time: 0, kind: 'set', args: ['ok', 'label', value] }],
  });
  assert.ok(!spec.includes(value));
  assert.ok(spec.includes('\\u003c/script\\u003e\\u2028\\u2029'));
});

test('generated Playwright spec matches the snapshot', () => {
  const input = readFileSync(
    new URL('./fixtures/recording-session.lino', import.meta.url),
    'utf8'
  );
  const expected = readFileSync(
    new URL('./fixtures/recording-session.spec.txt', import.meta.url),
    'utf8'
  );
  assert.equal(toPlaywright(input, { url: '/examples/animation/' }), expected);
});

test('browser fixture is exactly the generated spec executed by the e2e harness', () => {
  const input = readFileSync(
    new URL('./fixtures/recording-browser.lino', import.meta.url),
    'utf8'
  );
  const generated = readFileSync(
    new URL(
      '../../../tests/e2e/fixtures/recorder-generated.mjs',
      import.meta.url
    ),
    'utf8'
  );
  assert.equal(toPlaywright(input, { url: '/examples/animation/' }), generated);
});
