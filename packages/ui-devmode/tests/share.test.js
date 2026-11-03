import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { encodeShareHash, decodeShareHash, shareUrl } from '../src/share.js';
const fixtures = new globalThis.URL('./fixtures/overrides/', import.meta.url);
for (const file of readdirSync(fixtures)) {
  test(`share round trip ${file}`, () => {
    const text = readFileSync(new globalThis.URL(file, fixtures), 'utf8');
    assert.equal(decodeShareHash(encodeShareHash(text)), text);
  });
}
test('URL budget includes the whole URL, replaces old hash, and handles malformed escapes', () => {
  const prefix = 'https://example.org/?ui-dev';
  const size = 8192 - prefix.length - '#ui-overrides='.length;
  assert.equal(shareUrl(`${prefix}#old`, 'x'.repeat(size)).tooLong, false);
  assert.equal(shareUrl(prefix, 'x'.repeat(size + 1)).tooLong, true);
  assert.equal(decodeShareHash('#ui-overrides=%xx'), null);
  assert.equal(decodeShareHash('#other=x'), null);
});
