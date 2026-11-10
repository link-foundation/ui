import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createConfig, persistLayer } from '../src/index.js';
import { appDocument, memoryStorage } from './helpers.js';

test('storage sync replaces, removes and clears a layer without echoing; stop detaches', () => {
  const events = new globalThis.EventTarget();
  const storage = memoryStorage();
  const config = createConfig({ document: appDocument() });
  const source = createConfig({ document: appDocument() });
  source.set('user', 'ok', 'label', ['Go']);
  const text = source.exportPatch({ layers: ['user'], against: 'site' });
  const persistence = persistLayer(config, 'user', storage, 'settings', {
    sync: true,
    eventTarget: events,
  });
  let updates = 0;
  config.subscribe(() => updates++);
  const send = (key, newValue) =>
    events.dispatchEvent(
      Object.assign(new globalThis.Event('storage'), {
        key,
        newValue,
        storageArea: storage,
      })
    );
  send('other', text);
  assert.equal(updates, 0);
  send('settings', text);
  assert.equal(config.resolve('ok', 'label').value[0], 'Go');
  assert.equal(storage.data.size, 0);
  send('settings', 'invalid (((');
  assert.equal(config.resolve('ok', 'label').value[0], 'Go');
  send('settings', null);
  assert.equal(config.overrides('user').length, 0);
  send('settings', text);
  send(null, null);
  assert.equal(config.overrides('user').length, 0);
  persistence.stop();
  send('settings', text);
  assert.equal(config.overrides('user').length, 0);
});
