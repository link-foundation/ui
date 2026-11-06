/**
 * numeric-keys: the value every key moves a slider or a number field to,
 * Shift ×10, clamping to the range and rounding to the step.
 */

import { describe, it, expect } from 'test-anywhere';
import {
  clampStep,
  decimalsOf,
  nextValue,
  PAGE_STEPS,
  SHIFT_FACTOR,
} from '../../src/controls/numeric-keys.js';

const RANGE = { value: 50, min: 0, max: 100, step: 1 };

describe('nextValue', () => {
  it('steps up with ArrowUp and ArrowRight', () => {
    expect(nextValue('ArrowUp', RANGE)).toBe(51);
    expect(nextValue('ArrowRight', RANGE)).toBe(51);
  });

  it('steps down with ArrowDown and ArrowLeft', () => {
    expect(nextValue('ArrowDown', RANGE)).toBe(49);
    expect(nextValue('ArrowLeft', RANGE)).toBe(49);
  });

  it('moves ten steps with PageUp and PageDown', () => {
    expect(PAGE_STEPS).toBe(10);
    expect(nextValue('PageUp', RANGE)).toBe(60);
    expect(nextValue('PageDown', RANGE)).toBe(40);
  });

  it('goes to the minimum with Home and the maximum with End', () => {
    expect(nextValue('Home', RANGE)).toBe(0);
    expect(nextValue('End', RANGE)).toBe(100);
  });

  it('gives null for Home and End without that bound', () => {
    expect(nextValue('Home', { value: 3 })).toBe(null);
    expect(nextValue('End', { value: 3 })).toBe(null);
  });

  it('multiplies a step by ten with Shift', () => {
    expect(SHIFT_FACTOR).toBe(10);
    expect(nextValue('ArrowUp', { ...RANGE, shift: true })).toBe(60);
    expect(nextValue('ArrowLeft', { ...RANGE, shift: true })).toBe(40);
    expect(nextValue('PageUp', { ...RANGE, value: 0, shift: true })).toBe(100);
  });

  it('clamps to the range', () => {
    expect(nextValue('ArrowUp', { ...RANGE, value: 100 })).toBe(100);
    expect(nextValue('ArrowDown', { ...RANGE, value: 0 })).toBe(0);
    expect(nextValue('PageUp', { ...RANGE, value: 95 })).toBe(100);
    expect(nextValue('PageDown', { ...RANGE, value: 5 })).toBe(0);
    expect(nextValue('ArrowUp', { ...RANGE, value: 150 })).toBe(100);
  });

  it('rounds to the step from the minimum', () => {
    const range = { value: 0.3, min: 0, max: 1, step: 0.1 };
    expect(nextValue('ArrowUp', range)).toBe(0.4);
    expect(nextValue('ArrowDown', range)).toBe(0.2);
    expect(nextValue('ArrowUp', { value: 7, min: 1, max: 20, step: 5 })).toBe(
      11
    );
  });

  it('starts an empty value from the minimum, else zero', () => {
    expect(nextValue('ArrowUp', { value: NaN, min: 5, max: 9 })).toBe(6);
    expect(nextValue('ArrowDown', { value: NaN })).toBe(-1);
  });

  it('reverses the horizontal arrows right to left', () => {
    expect(nextValue('ArrowRight', { ...RANGE, rtl: true })).toBe(49);
    expect(nextValue('ArrowLeft', { ...RANGE, rtl: true })).toBe(51);
    expect(nextValue('ArrowUp', { ...RANGE, rtl: true })).toBe(51);
  });

  it('gives null for other keys', () => {
    for (const key of ['a', 'Enter', ' ', 'Tab', 'Escape']) {
      expect(nextValue(key, RANGE)).toBe(null);
    }
  });

  it('treats a missing or non-positive step as 1', () => {
    expect(nextValue('ArrowUp', { value: 2 })).toBe(3);
    expect(nextValue('ArrowUp', { value: 2, step: 0 })).toBe(3);
    expect(nextValue('ArrowUp', { value: 2, step: -4 })).toBe(3);
  });
});

describe('clampStep', () => {
  it('rounds to the nearest step and fixes float noise', () => {
    expect(clampStep(0.1 + 0.2, { step: 0.1 })).toBe(0.3);
    expect(clampStep(12, { step: 5 })).toBe(10);
    expect(clampStep(13, { step: 5 })).toBe(15);
    expect(clampStep(2.6, { min: 0.5, step: 1 })).toBe(2.5);
  });

  it('clamps to the bounds, the maximum even off the grid', () => {
    expect(clampStep(-3, { min: 0, max: 10 })).toBe(0);
    expect(clampStep(99, { min: 0, max: 10 })).toBe(10);
    expect(clampStep(9, { min: 0, max: 9.5, step: 1 })).toBe(9);
    expect(clampStep(9.4, { min: 0, max: 9.5, step: 1 })).toBe(9);
    expect(clampStep(10, { min: 0, max: 9.5, step: 1 })).toBe(9.5);
  });

  it('starts a value that is not a number from the minimum', () => {
    expect(clampStep(NaN, { min: 4 })).toBe(4);
    expect(clampStep(undefined)).toBe(0);
  });
});

describe('decimalsOf', () => {
  it('counts the decimals of plain and exponent numbers', () => {
    expect(decimalsOf(1)).toBe(0);
    expect(decimalsOf(0.25)).toBe(2);
    expect(decimalsOf(1e-7)).toBe(7);
    expect(decimalsOf(Infinity)).toBe(0);
  });
});

it('directional snapping consumes the first tick without skipping continuous imports', () => {
  const state = {
    value: 0.075,
    min: 0,
    max: 1,
    step: 0.01,
    snapping: 'directional',
  };
  expect(nextValue('ArrowUp', state)).toBe(0.08);
  expect(nextValue('ArrowDown', state)).toBe(0.07);
  expect(nextValue('PageUp', state)).toBe(0.17);
  expect(nextValue('PageDown', state)).toBe(0);
  expect(nextValue('ArrowUp', { ...state, shift: true })).toBe(0.17);
  expect(nextValue('ArrowRight', { ...state, rtl: true })).toBe(0.07);
  expect(nextValue('ArrowUp', { ...state, value: 0.07 })).toBe(0.08);
  expect(nextValue('ArrowDown', { ...state, value: 0.07 })).toBe(0.06);
  expect(nextValue('ArrowUp', { ...state, value: 1 })).toBe(1);
  expect(nextValue('ArrowDown', { ...state, value: 0 })).toBe(0);
  expect(
    nextValue('ArrowUp', { value: -0.025, step: 0.01, snapping: 'directional' })
  ).toBe(-0.02);
  expect(
    nextValue('ArrowDown', {
      value: 0.075,
      min: 0.005,
      step: 0.01,
      snapping: 'directional',
    })
  ).toBe(0.065);
  // Existing nearest-grid behavior stays available and remains the default.
  expect(nextValue('ArrowUp', { ...state, snapping: 'nearest' })).toBe(0.09);
});
