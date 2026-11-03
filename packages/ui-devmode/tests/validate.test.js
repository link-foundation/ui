import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '@link-foundation/ui-core';
import { sample } from './setup.js';
import { validateOverrides } from '../src/validate.js';
import { parseDevModePolicy } from '../src/policy.js';
const schema = parse(sample('document') + sample('tokens'));
const policy = parseDevModePolicy(`site: dev-mode
  locked-elements body
  repository link-foundation/ui
  site-config site/config/site.lino
  comfort-keys color.primary`);

test('accepts sample and new policy fields', () => {
  assert.deepEqual(
    validateOverrides(sample('overrides'), { schema }).rejected,
    []
  );
  assert.equal(policy.repository, 'link-foundation/ui');
  assert.equal(policy.siteConfig, 'site/config/site.lino');
  assert.equal(policy.warnings.length, 0);
});
for (const set of [
  'set missing label hi',
  'set ok unknown hi',
  'set ok disabled maybe',
  'set body gap red',
  'set ok variant weird',
  'set ok on press (emit surprise)',
  'on press (emit surprise)',
  'set material3 token missing red',
  'set material3 token color.primary 123',
  'set ok label (emit surprise)',
  'unset ok label',
]) {
  test(`rejects ${set}`, () => {
    assert.equal(
      validateOverrides(`x: overrides\n  ${set}`, { schema }).rejected.length,
      1
    );
  });
}
test('rejects locks including ancestors and comfort tokens', () => {
  assert.match(
    validateOverrides('x: overrides\n  set ok label hi', { schema, policy })
      .rejected[0].reason,
    /Locked/
  );
  assert.match(
    validateOverrides('x: overrides\n  set material3 token color.primary red', {
      schema,
      policy,
    }).rejected[0].reason,
    /Comfort/
  );
});
test('rejects size/depth limits, extra roots, unexpected children and invalid metadata', () => {
  for (const input of [
    'x'.repeat(65537),
    `${'('.repeat(20)}x y${')'.repeat(20)}`,
    'x: overrides\ny: overrides',
    'x: button',
    'x: overrides\n  base missing',
    'x: overrides\n  layer site',
    'x: overrides\n  layer user\n  layer session',
  ]) {
    assert.ok(
      validateOverrides(input, { schema }).rejected.length,
      input.slice(0, 100)
    );
  }
});

test('comfort keys protect element properties and reject mixed pasted input safely', () => {
  for (const comfortKeys of [new Set(['label']), new Set(['ok.label'])]) {
    const result = validateOverrides(
      'x: overrides\n  set ok label Shared\n  set greeting text Accepted',
      { schema, policy: { comfortKeys } }
    );
    assert.equal(result.rejected.length, 1);
    assert.match(result.rejected[0].reason, /Comfort/);
    assert.deepEqual(result.links[0].values.at(-1), [
      'set',
      'greeting',
      'text',
      'Accepted',
    ]);
  }
});
