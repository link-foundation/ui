import { describe, it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { toNativeStyle } from '../src/style.js';
import { readStyles, resolveStyle } from '@link-foundation/ui-style';
import { parse } from '@link-foundation/ui-core';

describe('native styles', () => {
  it('converts dimensions, tokens, aliases and colors; reports unsupported properties', () => {
    assert.deepEqual(
      toNativeStyle(
        {
          padding: '16px',
          gap: ['token', 'space.medium'],
          radius: '4px',
          background: '#6750A4',
          display: 'grid',
        },
        { 'space.medium': '8px' }
      ),
      {
        style: {
          padding: 16,
          gap: 8,
          borderRadius: 4,
          backgroundColor: '#6750A4',
        },
        warnings: ['unsupported native style display'],
      }
    );
    assert.equal(
      toNativeStyle({ gap: '(token space.medium)' }, { 'space.medium': 12 })
        .style.gap,
      12
    );
  });
  it('consumes resolved declarations and token maps from the style engine', () => {
    const rules = readStyles(
      "s: style (selector (type text)) (padding 16px) (color '#6750A4')"
    ).rules;
    const node = parse('hello: text Hi').roots[0];
    const resolved = resolveStyle(rules, new Map(), node);
    assert.deepEqual(toNativeStyle(resolved.style).style, {
      padding: 16,
      color: '#6750A4',
    });
    const tokens = new Map([
      [
        'space.medium',
        {
          path: 'space.medium',
          type: 'dimension',
          value: { type: 'dimension', value: 8, unit: 'px' },
        },
      ],
    ]);
    assert.deepEqual(
      toNativeStyle({ gap: ['token', 'space.medium'] }, tokens).style,
      { gap: 8 }
    );
  });
  it('reports missing/cyclic tokens and unsupported units', () => {
    assert.equal(
      toNativeStyle({ padding: ['token', 'missing'] }).warnings.length,
      1
    );
    assert.equal(
      toNativeStyle({ padding: ['token', 'a'] }, { a: ['token', 'a'] }).warnings
        .length,
      1
    );
    assert.equal(
      toNativeStyle({ padding: { type: 'dimension', value: 2, unit: 'rem' } })
        .warnings.length,
      1
    );
  });
});

it('expands resolved padding, gap and radius lists without passing arrays to native styles', () => {
  const dimension = (value) => ({ type: 'dimension', value, unit: 'px' });
  const list = (...numbers) => ({
    type: 'list',
    items: numbers.map(dimension),
  });
  assert.deepEqual(
    toNativeStyle({
      padding: list(4, 8),
      gap: list(6, 10),
      radius: list(1, 2, 3, 4),
    }),
    {
      style: {
        paddingTop: 4,
        paddingRight: 8,
        paddingBottom: 4,
        paddingLeft: 8,
        rowGap: 6,
        columnGap: 10,
        borderTopLeftRadius: 1,
        borderTopRightRadius: 2,
        borderBottomRightRadius: 3,
        borderBottomLeftRadius: 4,
      },
      warnings: [],
    }
  );
});
