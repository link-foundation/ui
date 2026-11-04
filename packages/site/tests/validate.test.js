import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateDocument } from '../src/playground/validate.js';

for (const [name, text] of [
  ['size', 'x'.repeat(65537)],
  ['depth', `${'('.repeat(40)}text hi${')'.repeat(40)}`],
  ['unknown kind', 'bad: unknown-kind'],
  ['unknown anonymous kind', 'document\n  unknown-kind bad'],
  ['javascript URL', "a: link\n  href 'javascript:alert(1)'"],
  ['obfuscated URL', "a: link\n  href 'java\tscript:alert(1)'"],
  ['positional image URL', "a: image 'javascript:alert(1)'"],
  ['source URL', "a: image\n  source 'data:image/svg+xml,bad'"],
  ['http URL', "a: image\n  src 'http://example.com/a.png'"],
  ['protocol relative', "a: link\n  href '//example.com/'"],
]) {
  test(`rejects ${name}`, () =>
    assert.ok(validateDocument(text).errors.length));
}
test('accepts relative and https URLs and disables actions and bindings', () => {
  const { tree, errors } = validateDocument(
    "demo: document\n  a: link\n    href 'https://example.com/'\n  b: button\n    label Safe\n    on press\n      navigate /other\n"
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(
    tree.byId.get('b').properties.find((p) => p.name === 'on').values,
    ['press', ['log', 'Action disabled in playground']]
  );
  assert.equal(
    validateDocument('a: link\n  href ../relative').errors.length,
    0
  );
});
test('syntax diagnostics include line and column', () => {
  const { errors } = validateDocument('demo: document\n  (bad');
  assert.ok(errors[0].line >= 2);
  assert.ok(errors[0].column >= 1);
});

test('the parser enforces depth for nested indented documents', () => {
  const nested = (depth) =>
    Array.from(
      { length: depth },
      (_, i) => `${'  '.repeat(i)}n${i}: ${i ? 'stack' : 'document'}`
    ).join('\n');
  assert.deepEqual(validateDocument(nested(31)).errors, []);
  assert.ok(
    validateDocument(nested(40)).errors.some((d) => d.code === 'depth-exceeded')
  );
});
