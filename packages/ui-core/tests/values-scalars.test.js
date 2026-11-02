/**
 * Numbers, dimensions and durations of docs/spec/values.md (#15).
 */

import { describe, it, expect } from 'test-anywhere';
import { values } from '@link-foundation/ui-core';
import { checkTyped } from './helpers.js';

const typed = (raw, type, expected) =>
  checkTyped(values, raw, { type }, expected, (a, b) => expect(a).toEqual(b));

describe('values: scalars', () => {
  it('types 16px as a dimension', () => {
    expect(values.typeValue('16px', { type: 'dimension' }).value).toEqual({
      type: 'dimension',
      value: 16,
      unit: 'px',
    });
  });

  it('types every dimension unit and a bare 0', () => {
    typed('1.5rem', 'dimension', {
      type: 'dimension',
      value: 1.5,
      unit: 'rem',
    });
    typed('2em', 'dimension', { type: 'dimension', value: 2, unit: 'em' });
    typed('50%', 'dimension', { type: 'dimension', value: 50, unit: '%' });
    typed('100vw', 'dimension', { type: 'dimension', value: 100, unit: 'vw' });
    typed('40vh', 'dimension', { type: 'dimension', value: 40, unit: 'vh' });
    typed('-8px', 'dimension', { type: 'dimension', value: -8, unit: 'px' });
    typed('.5em', 'dimension', { type: 'dimension', value: 0.5, unit: 'em' });
    typed('0', 'dimension', { type: 'dimension', value: 0, unit: '' });
  });

  it('types 150ms and 0.2s as durations', () => {
    typed('150ms', 'duration', { type: 'duration', value: 150, unit: 'ms' });
    typed('0.2s', 'duration', { type: 'duration', value: 0.2, unit: 's' });
  });

  it('types numbers with signs, fractions and exponents', () => {
    typed('-1', 'number', { type: 'number', value: -1 });
    typed('1.5e3', 'number', { type: 'number', value: 1500 });
    typed('2.5E-2', 'number', { type: 'number', value: 0.025 });
    typed('0.5', 'number', { type: 'number', value: 0.5 });
  });

  it('rejects malformed scalars', () => {
    const cases = [
      ['16pt', 'dimension'],
      ['px', 'dimension'],
      ['16', 'dimension'],
      ['--1px', 'dimension'],
      ['-1s', 'duration'],
      ['1.', 'number'],
      ['1e', 'number'],
      ['abc', 'number'],
      ['2 seconds', 'duration'],
    ];
    for (const [raw, type] of cases) {
      const { value, diagnostics } = values.typeValue(raw, { type });
      expect([raw, value, diagnostics.map((d) => d.code)]).toEqual([
        raw,
        null,
        ['invalid-value'],
      ]);
    }
  });

  it('splits quantities with the given units only', () => {
    expect(values.splitQuantity('12px', ['px'])).toEqual({
      value: 12,
      unit: 'px',
    });
    expect(values.splitQuantity('12px', ['ms'])).toBe(null);
    expect(values.parseNumber('7')).toBe(7);
    expect(values.parseNumber('7x')).toBe(null);
    expect(values.DIMENSION_UNITS).toEqual([
      'px',
      'rem',
      'em',
      '%',
      'vw',
      'vh',
    ]);
    expect(values.DURATION_UNITS).toEqual(['ms', 's']);
  });
});
