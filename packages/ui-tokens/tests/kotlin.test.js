/**
 * `toKotlin(resolved, { packageName, name })`: the tokens as Jetpack
 * Compose constants.
 */

import { describe, it, expect } from 'test-anywhere';
import { toKotlin } from '@link-foundation/ui-tokens';
import { full, golden, resolveText, sample } from './helpers.js';

describe('toKotlin', () => {
  it('equals the golden file for the issue-1 sample', () => {
    const kotlin = toKotlin(sample());
    expect(kotlin).toBe(golden('Tokens.kt', kotlin));
  });

  it('equals the golden file for the full fixture', () => {
    const kotlin = toKotlin(full(), {
      packageName: 'com.example.brand',
      name: 'BrandTokens',
    });
    expect(kotlin).toBe(golden('full/BrandTokens.kt', kotlin));
  });

  it('writes one typed constant per token with only the imports it needs', () => {
    const kotlin = toKotlin(sample());
    expect(
      kotlin.startsWith(
        'import androidx.compose.ui.graphics.Color\nimport androidx.compose.ui.unit.dp\n'
      )
    ).toBe(true);
    expect(kotlin).toContain('object Tokens {\n');
    expect(kotlin).toContain('    val ColorPrimary = Color(0xFF6750A4)\n');
    expect(kotlin).toContain('    val SpaceMedium = 16.dp\n');
    expect(kotlin).toContain('    const val MotionDurationShortMs = 150\n');
    expect(kotlin).not.toContain('package ');
  });

  it('writes the package, the name, aliases and modes', () => {
    const kotlin = toKotlin(full(), {
      packageName: 'com.example.brand',
      name: 'BrandTokens',
    });
    expect(kotlin.startsWith('package com.example.brand\n\n')).toBe(true);
    expect(kotlin).toContain('object BrandTokens {\n');
    expect(kotlin).toContain(
      '    val ColorAction = BrandTokens.ColorPrimary\n'
    );
    expect(kotlin).toContain('    object Dark {\n');
    expect(kotlin).toContain(
      '        val ColorAction = BrandTokens.Dark.ColorPrimary\n'
    );
    expect(kotlin).toContain('data class Shadow(');
    expect(kotlin).toContain('data class Typography(');
    expect(kotlin).toContain('    val ColorScrim = Color(0x80000000)\n');
  });

  it('declares an alias target before the alias (objects initialise in order)', () => {
    const kotlin = toKotlin(
      resolveText(
        '(t: theme (token a (token b)) (token b 1px) (mode dark (token b 2px)))',
        't'
      )
    );
    expect(kotlin).toContain('    val B = 1.dp\n    val A = Tokens.B\n');
    expect(kotlin).toContain(
      '        val B = 2.dp\n        val A = Tokens.Dark.B\n'
    );
  });

  it('throws when two paths give the same constant', () => {
    const resolved = resolveText(
      '(t: theme (token a.b 1px) (token a-b 2px))',
      't'
    );
    expect(() => toKotlin(resolved)).toThrow(TypeError);
  });
});
