import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createConfig, persistLayer } from '../src/index.js';
import { appDocument } from './helpers.js';

test('storage sync replaces, removes and clears a layer without echoing; stop detaches', () => {
  const dom = new JSDOM('', { url: 'https://example.test' });
  const win = dom.window;
  const config = createConfig({ document: appDocument() });
  const source = createConfig({ document: appDocument() });
  source.set('user', 'ok', 'label', ['Go']);
  const text = source.exportPatch({ layers: ['user'], against: 'site' });
  const persistence = persistLayer(
    config,
    'user',
    win.localStorage,
    'settings',
    { sync: true, eventTarget: win }
  );
  let updates = 0;
  config.subscribe(() => updates++);
  const send = (key, newValue) =>
    win.dispatchEvent(
      new win.StorageEvent('storage', {
        key,
        newValue,
        storageArea: win.localStorage,
      })
    );
  send('other', text);
  assert.equal(updates, 0);
  send('settings', text);
  assert.equal(config.resolve('ok', 'label').value[0], 'Go');
  assert.equal(win.localStorage.length, 0);
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
  dom.window.close();
});
