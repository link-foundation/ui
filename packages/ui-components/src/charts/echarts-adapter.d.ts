import type { ChartSpec } from '../index.js';

export interface EChartsOptions {
  theme?: 'light' | 'dark';
  width?: number;
  height?: number;
}

/**
 * The ECharts option of a chart spec: plain data (no functions), the same
 * for the same spec, with the literal chart token colours of the theme.
 */
export declare function toEChartsOption(
  spec: ChartSpec,
  options?: EChartsOptions
): Record<string, unknown>;

/** Draw a chart with ECharts, loaded on demand (`import('echarts')`). */
export declare function renderECharts(
  container: HTMLElement,
  spec: ChartSpec,
  options?: EChartsOptions & { loadECharts?: () => Promise<unknown> }
): Promise<{ instance: unknown; option: Record<string, unknown> }>;
