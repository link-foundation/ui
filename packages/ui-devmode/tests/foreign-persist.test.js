import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chromeStorageAdapter,
  localStorageAdapter,
  loadOverrides,
  saveOverrides,
} from '../src/foreign/persist.js';

for (const kind of ['local', 'chrome']) {
  test(`${kind} async storage isolates origin and pathname`, async () => {
    const values = new Map();
    const storage =
      kind === 'local'
        ? localStorageAdapter({
            getItem: (key) => values.get(key),
            setItem: (key, value) => values.set(key, value),
          })
        : chromeStorageAdapter({
            get: async (key) => ({ [key]: values.get(key) }),
            set: async (value) =>
              Object.entries(value).forEach(([k, v]) => values.set(k, v)),
          });
    const location = { origin: 'https://example.org', pathname: '/one' };
    assert.equal(await loadOverrides(storage, location), '');
    await saveOverrides(
      storage,
      location,
      'changes: overrides\n  layer session\n'
    );
    assert.match(await loadOverrides(storage, location), /changes/);
    assert.equal(
      await loadOverrides(storage, { ...location, pathname: '/two' }),
      ''
    );
    assert.equal(
      await loadOverrides(storage, {
        ...location,
        origin: 'https://other.org',
      }),
      ''
    );
  });
}

test('storage failures remain visible to callers', async () => {
  const storage = {
    getItem: async () => {
      throw new Error('denied');
    },
    setItem: async () => {
      throw new Error('quota');
    },
  };
  await assert.rejects(loadOverrides(storage, {}), /denied/);
  await assert.rejects(saveOverrides(storage, {}, ''), /quota/);
});
