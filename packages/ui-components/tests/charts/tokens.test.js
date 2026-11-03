/**
 * The chart colour tokens: `color.chart.1` ... `color.chart.8` are a
 * valid ui-tokens theme, and each meets WCAG 2.2 contrast with the chart
 * background in light and dark mode.
 */

import { describe, it, expect } from 'test-anywhere';
import { readTokens, resolveTokens, toCss } from '@link-foundation/ui-tokens';
import {
  CHART_CSS,
  CHART_TOKENS,
  SERIES_COUNT,
  chartTokensLino,
  seriesToken,
  tokenColor,
} from '../../src/charts/tokens.js';

/** WCAG relative luminance of `{r, g, b}` in 0..1. */
const luminance = ({ r, g, b }) => {
  const linear = (c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
};

/** WCAG contrast ratio of two colours. */
const contrast = (a, b) => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
};

/** The resolved colour of every token path in a mode. */
function resolved(mode) {
  const { sets, diagnostics } = readTokens(chartTokensLino());
  expect(diagnostics).toEqual([]);
  const tokens = resolveTokens(sets, 'charts');
  expect(tokens.diagnostics).toEqual([]);
  const overrides = mode === 'light' ? new Map() : tokens.modes.get(mode);
  return (path) => (overrides.get(path) ?? tokens.get(path)).value;
}

const SERIES = Array.from({ length: SERIES_COUNT }, (_, i) => seriesToken(i));

describe('chart colour tokens', () => {
  it('names the series color.chart.1 to color.chart.8, cycling after', () => {
    expect(SERIES[0]).toBe('color.chart.1');
    expect(SERIES[7]).toBe('color.chart.8');
    expect(seriesToken(8)).toBe('color.chart.1');
  });

  for (const mode of ['light', 'dark']) {
    it(`gives every series at least 3:1 contrast in ${mode} mode`, () => {
      const color = resolved(mode);
      const background = color('color.chart.background');
      for (const path of SERIES) {
        expect(contrast(color(path), background)).toBeGreaterThanOrEqual(3);
      }
    });

    it(`gives the chart text at least 4.5:1 contrast in ${mode} mode`, () => {
      const color = resolved(mode);
      const background = color('color.chart.background');
      for (const path of ['color.chart.text', 'color.chart.muted']) {
        expect(contrast(color(path), background)).toBeGreaterThanOrEqual(4.5);
      }
      expect(
        contrast(color('color.chart.axis'), background)
      ).toBeGreaterThanOrEqual(3);
    });
  }

  it('exports to the same CSS custom properties the renderer uses', () => {
    const { sets } = readTokens(chartTokensLino());
    const css = toCss(resolveTokens(sets, 'charts'));
    expect(css).toContain('--color-chart-1: #1f6fb2;');
    expect(tokenColor('color.chart.1')).toBe('var(--color-chart-1, #1f6fb2)');
    expect(CHART_CSS).toContain('--color-chart-1: #60a5fa;');
    expect(CHART_CSS).toContain('prefers-color-scheme: dark');
    expect(CHART_CSS).toContain('prefers-reduced-motion: no-preference');
  });

  it('has the same token paths in both modes', () => {
    expect(Object.keys(CHART_TOKENS.dark)).toEqual(
      Object.keys(CHART_TOKENS.light)
    );
  });
});
