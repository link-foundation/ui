import { parseLinks } from '@link-foundation/ui-core';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPage } from './setup.js';
import { applySharedOverrides, BACKUP_KEY } from '../src/apply-shared.js';
import { encodeShareHash } from '../src/share.js';
import { translator } from '../src/messages.js';
import { renderAgentInstruction } from '../src/agent-instruction.js';

test('preview, backup, hash stripping, Keep and Discard use only session', () => {
  const { window, config, document } = createPage();
  config.set('user', 'ok', 'label', ['Mine']);
  config.set('session', 'greeting', 'text', ['Previous']);
  const text = 'x: overrides\n  set ok label Shared\n  set missing label Bad';
  window.location.hash = encodeShareHash(text);
  const options = {
    config,
    location: window.location,
    history: window.history,
    storage: window.localStorage,
    document,
    t: translator(),
  };
  const report = applySharedOverrides(options);
  assert.equal(report.applied, true);
  assert.equal(report.rejected.length, 1);
  assert.equal(config.resolve('ok', 'label').layer, 'session');
  assert.deepEqual(config.valueIn('user', 'ok', 'label'), ['Mine']);
  assert.equal(window.location.hash, '');
  const [backup] = parseLinks(window.localStorage.getItem(BACKUP_KEY));
  assert.deepEqual(backup.values[1], ['name', 'Before the link']);
  assert.equal(backup.values[2].length, 2);
  assert.equal(backup.values[3].length, 2);
  assert.match(document.querySelector('aside').textContent, /Unknown element/);
  report.discard();
  assert.deepEqual(config.resolve('ok', 'label').value, ['Mine']);
  assert.deepEqual(config.resolve('greeting', 'text').value, ['Previous']);
  const kept = applySharedOverrides({ ...options, text });
  kept.keep();
  assert.deepEqual(config.resolve('ok', 'label').value, ['Shared']);
  window.close();
});
test('storage failure and malformed input cannot change config', () => {
  const { window, config } = createPage();
  const report = applySharedOverrides({
    config,
    text: 'x: overrides\n  set ok label Shared',
    storage: {
      setItem() {
        throw new Error('storage denied');
      },
    },
  });
  assert.equal(report.applied, false);
  assert.equal(config.overrides('session').length, 0);
  assert.match(report.rejected[0].reason, /storage denied/);
  window.close();
});
test('agent template contains values and uses clear unknown markers', () => {
  const values = {
    repository: 'link-foundation/ui',
    siteConfig: 'site/config/site.lino',
    overrides: 'x: overrides\n  set ok label Hello',
  };
  const rendered = renderAgentInstruction(values);
  for (const value of Object.values(values)) {
    assert.ok(rendered.includes(value));
  }
  assert.doesNotMatch(rendered, /\{\w+\}/);
  assert.match(renderAgentInstruction(), /<unknown repository>/);
  assert.match(
    renderAgentInstruction({ ...values, overrides: '{repository}' }),
    /\{repository\}/
  );
});

test('disabled or session-restricted policy rejects previews without writes', () => {
  const { window, config } = createPage();
  for (const policy of [
    { enabled: false, writeLayers: ['session'] },
    { enabled: true, writeLayers: ['user'] },
  ]) {
    const report = applySharedOverrides({
      config,
      policy,
      text: 'x: overrides\n  set ok label Shared',
      storage: window.localStorage,
    });
    assert.equal(report.applied, false);
    assert.equal(config.overrides('session').length, 0);
    assert.equal(window.localStorage.getItem(BACKUP_KEY), null);
  }
  window.close();
});

test('shared previews retain registered comfort properties without hardcoded policy keys', () => {
  const { window, config } = createPage();
  config.registerComfort('ok', 'label');
  config.set('user', 'ok', 'label', ['Mine']);
  const report = applySharedOverrides({
    config,
    text: 'x: overrides\n  set ok label Shared\n  set greeting text Welcome',
    storage: window.localStorage,
  });
  assert.equal(report.applied, true);
  assert.deepEqual(config.resolve('ok', 'label').value, ['Mine']);
  assert.deepEqual(config.resolve('greeting', 'text').value, ['Welcome']);
  report.discard();
  assert.deepEqual(config.resolve('ok', 'label').value, ['Mine']);
  window.close();
});
