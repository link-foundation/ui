/**
 * readPatch and writePatch: the `overrides` patch format.
 */

import { describe, it, expect } from 'test-anywhere';
import {
  DEFAULT_MAX_PATCH_OPS,
  DEFAULT_MAX_PATCH_SIZE,
  readPatch,
  writePatch,
} from '@link-foundation/ui-config';
import { FIXTURES, fixture, sample } from './helpers.js';

const codes = (patch) => patch.diagnostics.map((d) => d.code);

describe('readPatch', () => {
  it('reads the overrides sample', () => {
    const patch = readPatch(sample('overrides.lino'));
    expect(patch.diagnostics).toEqual([]);
    expect(patch.name).toBe('user-overrides');
    expect(patch.layer).toBe('user');
    expect(patch.base).toBe('app');
    expect(patch.ops).toEqual([
      {
        op: 'set',
        id: 'greeting',
        name: 'text',
        key: null,
        values: ['Hello, agents'],
      },
      {
        op: 'set',
        id: 'material3',
        name: 'token',
        key: 'color.primary',
        values: ['#00639B'],
      },
    ]);
  });

  it('reads unset with and without a key, and nested values', () => {
    const patch = readPatch(
      '(p: overrides (layer session) (unset ok label) (unset m token a.b) (set b gap (token space.large)))'
    );
    expect(patch.diagnostics).toEqual([]);
    expect(patch.ops).toEqual([
      { op: 'unset', id: 'ok', name: 'label', key: null },
      { op: 'unset', id: 'm', name: 'token', key: 'a.b' },
      {
        op: 'set',
        id: 'b',
        name: 'gap',
        key: null,
        values: [['token', 'space.large']],
      },
    ]);
  });

  it('honours the keyedProps option', () => {
    const text = '(p: overrides (set m token a.b 1) (set m size small 2))';
    expect(readPatch(text, { keyedProps: ['size'] }).ops).toEqual([
      { op: 'set', id: 'm', name: 'token', key: null, values: ['a.b', '1'] },
      { op: 'set', id: 'm', name: 'size', key: 'small', values: ['2'] },
    ]);
  });

  it('writes every fixture back to the same ops', () => {
    for (const text of [sample('overrides.lino'), ...FIXTURES.map(fixture)]) {
      const patch = readPatch(text);
      expect(patch.diagnostics).toEqual([]);
      expect(patch.ops.length > 0).toBe(true);
      const again = readPatch(writePatch(patch));
      expect(again.diagnostics).toEqual([]);
      expect(again.ops).toEqual(patch.ops);
      expect([again.name, again.layer, again.base]).toEqual([
        patch.name,
        patch.layer,
        patch.base,
      ]);
    }
  });

  it('writes the sample text exactly', () => {
    expect(writePatch(readPatch(sample('overrides.lino')))).toBe(
      sample('overrides.lino')
    );
  });

  it('turns bad ops into diagnostics', () => {
    const patch = readPatch(`(p: overrides
  (layer user)
  (set)
  (set ok)
  (set ok label)
  (set m token)
  (unset ok label extra)
  (move ok body)
  (bogus: text x))`);
    expect(codes(patch)).toEqual([
      'missing-id',
      'missing-name',
      'missing-value',
      'missing-key',
      'unexpected-value',
      'unknown-op',
      'unknown-op',
    ]);
    expect(patch.ops).toEqual([
      { op: 'unset', id: 'ok', name: 'label', key: null },
    ]);
  });

  it('rejects unknown layers, other links and text that is not a patch', () => {
    expect(codes(readPatch('(p: overrides (layer cloud))'))).toEqual([
      'unknown-layer',
    ]);
    expect(codes(readPatch('(a: text hi)'))).toEqual(['not-a-patch']);
    expect(codes(readPatch('(a b'))).toEqual(['syntax-error']);
    expect(codes(readPatch(42))).toEqual(['not-a-patch']);
    expect(readPatch('').diagnostics).toEqual([]);
    expect(codes(readPatch('(p: overrides)\n(q: overrides)'))).toEqual([
      'extra-links',
    ]);
  });

  it('enforces the size and op limits', () => {
    expect(DEFAULT_MAX_PATCH_SIZE).toBe(65536);
    expect(DEFAULT_MAX_PATCH_OPS).toBe(2000);
    const ops = Array.from({ length: 5 }, (_, i) => `(set ok label v${i})`);
    const text = `(p: overrides ${ops.join(' ')})`;
    expect(readPatch(text, { maxOps: 5 }).ops.length).toBe(5);
    const tooMany = readPatch(text, { maxOps: 4 });
    expect(codes(tooMany)).toEqual(['too-many-ops']);
    expect(tooMany.ops).toEqual([]);
    const tooLarge = readPatch(text, { maxSize: 20 });
    expect(codes(tooLarge)).toEqual(['patch-too-large']);
    expect(tooLarge.ops).toEqual([]);
    const big = `(p: overrides (set ok label '${'x'.repeat(DEFAULT_MAX_PATCH_SIZE)}'))`;
    expect(codes(readPatch(big))).toEqual(['patch-too-large']);
    // The limit counts UTF-8 bytes: 'é€😀' is 9 bytes in 3 characters.
    const wide = "(p: overrides (set ok label 'é€😀'))";
    expect(wide.length).toBe(36);
    expect(readPatch(wide, { maxSize: 41 }).ops.length).toBe(1);
    expect(codes(readPatch(wide, { maxSize: 40 }))).toEqual([
      'patch-too-large',
    ]);
  });
});
