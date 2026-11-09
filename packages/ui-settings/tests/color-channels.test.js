import { it } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { applyToRoot, hexToChannels } from '../src/index.js';
import { demoSchema } from './helpers.js';
it('converts picked hex colors and applies optional channels without changing default output', () => {
  assert.equal(hexToChannels('#123'), '17 34 51');
  assert.equal(hexToChannels('#1238'), '17 34 51');
  assert.equal(hexToChannels('#abcdef80'), '171 205 239');
  for (const invalid of ['red', '#12', '#12345', '#xyzxyz', null]) {
    assert.throws(() => hexToChannels(invalid), TypeError);
  }
  const dom = new JSDOM('<!doctype html>');
  const root = dom.window.document.documentElement;
  applyToRoot(demoSchema(), { accent: '#123456' }, root);
  assert.equal(root.style.getPropertyValue('--accent-rgb'), '');
  applyToRoot(demoSchema(), { accent: '#123456' }, root, { channels: true });
  assert.equal(root.style.getPropertyValue('--accent-rgb'), '18 52 86');
  dom.window.close();
});
