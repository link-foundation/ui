/**
 * Behaviour: every colour of a link view is a ui-tokens design token, with
 * a dark mode, and the blueprint colours keep their roles (start green, end
 * red, centre black or the line colour in dark mode, other points blue).
 */

import { describe, it, expect } from 'test-anywhere';
import {
  COLOR_TOKENS,
  colorVariables,
  linkColors,
} from '../../src/links-view/tokens.js';

/** The relative luminance of `#RRGGBB` (WCAG 2.2). */
function luminance(hex) {
  const channel = (i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('linkColors', () => {
  it('resolves every role in light and dark mode', () => {
    for (const mode of [null, 'light', 'dark']) {
      const colors = linkColors({ mode });
      expect(Object.keys(colors).sort()).toEqual(
        Object.keys(COLOR_TOKENS).sort()
      );
      expect(Object.isFrozen(colors)).toBe(true);
    }
  });

  it('keeps the blueprint roles', () => {
    const light = linkColors();
    expect(light.blueprintStart).toBe('#2E7D32');
    expect(light.blueprintEnd).toBe('#C62828');
    expect(light.blueprintCenter).toBe('#000000');
    expect(light.blueprintPoint).toBe('#1565C0');
    const dark = linkColors({ mode: 'dark' });
    expect(dark.blueprintCenter).toBe(dark.line);
    expect(dark.source).toBe(dark.line);
    expect(light.target).toBe(light.line);
  });

  it('meets 3:1 against the background for every drawn colour', () => {
    for (const mode of [null, 'dark']) {
      const colors = linkColors({ mode });
      for (const role of [
        'line',
        'source',
        'target',
        'blueprintStart',
        'blueprintEnd',
        'blueprintCenter',
        'blueprintPoint',
        'focus',
      ]) {
        const ratio = contrast(colors[role], colors.background);
        expect({ mode, role, ok: ratio >= 3 }).toEqual({
          mode,
          role,
          ok: true,
        });
      }
    }
  });

  it('reads another token set', () => {
    const tokens = `(link-view: theme
      ${Object.values(COLOR_TOKENS)
        .map((path) => `(token ${path} '#101010')`)
        .join('\n')})`;
    expect(linkColors({ tokens }).line).toBe('#101010');
  });

  it('fails on a missing token', () => {
    const tokens = "(link-view: theme (token color.link.line '#101010'))";
    expect(() => linkColors({ tokens })).toThrow();
  });
});

describe('colorVariables', () => {
  it('names the CSS custom properties of the tokens', () => {
    const names = colorVariables();
    expect(names.line).toBe('--color-link-line');
    expect(names.blueprintStart).toBe('--color-link-blueprint-start');
  });
});
