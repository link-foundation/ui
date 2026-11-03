import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, parseLinks } from '@link-foundation/ui-core';
import { createConfig } from '@link-foundation/ui-config';
import { sample } from './setup.js';
import { exportOverrides } from '../src/export.js';

test('sample edits export exactly the sample overrides and round trip', () => {
  const config = createConfig({
    document: parse(sample('document') + sample('tokens')),
  });
  config.set('session', 'material3', 'token', ['#00639B'], 'color.primary');
  config.set('user', 'greeting', 'text', ['Hello, agents']);
  const result = exportOverrides(config);
  assert.equal(result.count, 2);
  assert.deepEqual(result.links, parseLinks(sample('overrides')));
  assert.deepEqual(parseLinks(result.text), result.links);
  config.set('session', 'greeting', 'text', ['Hello, links']);
  assert.equal(exportOverrides(config).count, 1);
});

test('large local edits remain available to copy as LiNo beyond share limits', () => {
  const config = createConfig({ document: parse(sample('document')) });
  const value = 'x'.repeat(66000);
  config.set('user', 'ok', 'label', [value]);
  const result = exportOverrides(config);
  assert.equal(result.count, 1);
  assert.ok(result.text.includes(value));
});
