import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeShare, decodeShare } from '../src/playground/share.js';
import { deflateRawSync } from 'node:zlib';
import { loadCatalog } from '../src/gallery/catalog.js';

test('share round trips every example, Unicode and hex colours', async () => {
  const examples = (await loadCatalog()).flatMap((c) =>
    c.examples.map((e) => e.text)
  );
  for (const text of [...examples, "hello: text 'Привет 🌍 #6750A4'"]) {
    const result = await encodeShare(text);
    assert.equal(result.tooLong, false);
    assert.equal(await decodeShare(result.hash), text);
  }
});
test('compressed shares, corrupt hashes and unsupported compression are bounded', async () => {
  const text = 'Привет #6750A4 '.repeat(500);
  const result = await encodeShare(text);
  assert.ok(result.hash.startsWith('#lino-z='));
  assert.equal(await decodeShare(result.hash), text);
  for (const hash of [
    '#lino=%xx',
    '#lino-z=!',
    '#other=hello',
    '#lino-z=aaaa',
  ]) {
    assert.equal(await decodeShare(hash), null);
  }
  assert.equal((await encodeShare('x'.repeat(65537))).tooLong, true);
  assert.equal(await decodeShare(`#lino=${'x'.repeat(65537)}`), null);
  const unsupported = { CompressionStream: null, DecompressionStream: null };
  assert.equal((await encodeShare(text, unsupported)).tooLong, true);
  const bomb = await encodeShare('x'.repeat(65536));
  assert.equal((await decodeShare(bomb.hash)).length, 65536);
});

test('decompression rejects oversized text and bounds expanded output', async () => {
  for (const size of [65537, 262145]) {
    const hash = `#lino-z=${deflateRawSync('x'.repeat(size)).toString('base64url')}`;
    assert.equal(await decodeShare(hash), null);
  }
});

test('compression accounts for the full page URL budget', async () => {
  const text = 'x'.repeat(8000);
  const result = await encodeShare(text, globalThis, 7900);
  assert.equal(result.tooLong, false);
  assert.ok(result.hash.startsWith('#lino-z='));
  assert.equal(await decodeShare(result.hash), text);
});
