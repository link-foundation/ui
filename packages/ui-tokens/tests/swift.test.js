/**
 * `toSwift(resolved, { name })`: the tokens as SwiftUI constants.
 */

import { describe, it, expect } from 'test-anywhere';
import { toSwift } from '@link-foundation/ui-tokens';
import { full, golden, resolveText, sample } from './helpers.js';

describe('toSwift', () => {
  it('equals the golden file for the issue-1 sample', () => {
    const swift = toSwift(sample());
    expect(swift).toBe(golden('Tokens.swift', swift));
  });

  it('equals the golden file for the full fixture', () => {
    const swift = toSwift(full(), { name: 'BrandTokens' });
    expect(swift).toBe(golden('full/BrandTokens.swift', swift));
  });

  it('writes one typed constant per token', () => {
    const swift = toSwift(sample());
    expect(swift).toContain('import SwiftUI\n');
    expect(swift).toContain('public enum Tokens {\n');
    expect(swift).toContain(
      '  public static let colorPrimary = Color(red: 0.404, green: 0.314, blue: 0.643, opacity: 1)\n'
    );
    expect(swift).toContain('  public static let spaceMedium: CGFloat = 16\n');
    expect(swift).toContain(
      '  public static let motionDurationShort: TimeInterval = 0.15\n'
    );
  });

  it('names the enum, references aliases and puts modes in nested enums', () => {
    const swift = toSwift(full(), { name: 'BrandTokens' });
    expect(swift).toContain('public enum BrandTokens {\n');
    expect(swift).toContain('/// Brand colour\n');
    expect(swift).toContain(
      '  public static let colorAction = BrandTokens.colorPrimary\n'
    );
    expect(swift).toContain('  public enum Dark {\n');
    expect(swift).toContain(
      '    public static let colorAction = BrandTokens.Dark.colorPrimary\n'
    );
    expect(swift).toContain('public struct Shadow');
    expect(swift).toContain('public struct Typography');
    expect(toSwift(sample())).not.toContain('struct');
  });

  it('converts rem to points and escapes keywords', () => {
    const swift = toSwift(
      resolveText('(t: theme (token size.root 1.5rem) (token default 1))', 't')
    );
    expect(swift).toContain('public static let sizeRoot: CGFloat = 24\n');
    expect(swift).toContain('public static let `default`: Double = 1\n');
  });

  it('throws when two paths give the same constant', () => {
    const resolved = resolveText(
      '(t: theme (token a.b 1px) (token a-b 2px))',
      't'
    );
    expect(() => toSwift(resolved)).toThrow(TypeError);
  });
});
