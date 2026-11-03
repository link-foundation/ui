import { it } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { themeBootScript } from '../src/themes/boot.js';

it('applies saved choices synchronously before paint in at most 1KB', () => {
  const attrs = new Map();
  const script = themeBootScript({ storageKey: 'preferences' });
  assert.ok(Buffer.byteLength(script) <= 1024);
  runInNewContext(script, {
    localStorage: {
      getItem: (key) => {
        assert.equal(key, 'preferences');
        return '{"theme":"base","scheme":"dark"}';
      },
    },
    document: {
      documentElement: { setAttribute: (key, value) => attrs.set(key, value) },
    },
  });
  assert.equal(attrs.get('data-theme'), 'base');
  assert.equal(attrs.get('data-scheme'), 'dark');
});
it('ignores unavailable storage, invalid JSON, invalid choices and HTML closing text', () => {
  for (const value of [
    '{',
    'null',
    '{"theme":"<script>","scheme":"unknown"}',
  ]) {
    runInNewContext(themeBootScript(), {
      localStorage: { getItem: () => value },
      document: { documentElement: { setAttribute: () => assert.fail() } },
    });
  }
  runInNewContext(themeBootScript(), {
    localStorage: {
      getItem: () => {
        throw new Error('blocked');
      },
    },
  });
  assert.ok(
    !themeBootScript({ storageKey: '</script>' }).includes('</script>')
  );
});
