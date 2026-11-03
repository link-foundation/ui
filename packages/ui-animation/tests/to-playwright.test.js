import { URL } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toPlaywright } from '../src/index.js';

test('generated literals escape script boundaries and Unicode line separators', () => {
  const value = '</script>\u2028\u2029';
  const spec = toPlaywright({
    id: 'hostile-values',
    events: [{ time: 0, kind: 'set', args: ['<ok>', 'label', value] }],
  });
  assert.ok(!spec.includes(value));
  assert.ok(spec.includes('\\u003c/script\\u003e\\u2028\\u2029'));
  const expression = spec
    .split('\n')
    .find((line) => line.includes('toHaveText'))
    .split('page.locator(')[1]
    .split(')).toHaveText')[0];
  assert.equal(JSON.parse(expression), '[data-link-id="<ok>"]');
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

test('native keyboard browser fixture is the exact generated spec', () => {
  const input = readFileSync(
    new URL('./fixtures/recording-native.lino', import.meta.url),
    'utf8'
  );
  const generated = readFileSync(
    new URL(
      '../../../tests/e2e/fixtures/recorder-native-generated.mjs',
      import.meta.url
    ),
    'utf8'
  );
  assert.equal(
    toPlaywright(input, { url: '/tests/ui/pages/recorder-native.html' }),
    generated
  );
});

test('redacted keys export synthetic events without typing the placeholder', () => {
  const spec = toPlaywright({
    id: 'redacted-key',
    events: [
      {
        time: 0,
        kind: 'input',
        args: ['key', 'down', '***', ['target', 'password']],
      },
    ],
  });
  assert.ok(spec.includes('dispatchEvent("keydown", { key: "***" })'));
  assert.ok(!spec.includes('page.keyboard.down'));
});
