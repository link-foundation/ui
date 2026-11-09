import type { CommonOptions, LayerHandle } from './common.js';
export interface GridOptions extends CommonOptions {
  cellSize?: number;
  lineWidth?: number;
  markLength?: number;
  pattern?: 'lines' | 'dashed' | 'crosses' | 'dots';
  tint?: 'line' | 'accent' | 'second-accent' | 'custom';
  color?: string;
  radialFade?: boolean;
  period?: number;
  onDrift?: (px: number) => void;
}
export function mount(
  element: HTMLElement,
  options?: GridOptions
): LayerHandle<GridOptions>;
