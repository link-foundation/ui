import type { CommonOptions, LayerHandle, GridCoordinates } from './common.js';
export interface GridOptions extends CommonOptions, GridCoordinates {
  lineWidth?: number;
  markLength?: number;
  pattern?: 'lines' | 'dashed' | 'crosses' | 'dots';
  tint?: 'line' | 'accent' | 'second-accent' | 'custom';
  color?: string;
  radialFade?: boolean;
  period?: number;
  /** Live CSS custom-property names for tint colors and a separate opacity multiplier. */
  tokens?: Partial<
    Record<'line' | 'accent' | 'second-accent' | 'custom' | 'alpha', string>
  >;
  onDrift?: (px: number) => void;
}
export function mount(
  element: HTMLElement,
  options?: GridOptions
): LayerHandle<GridOptions>;
/** Return the phase in CSS pixels for a clock and period in milliseconds. */
export function gridOffset(
  time: number,
  cellSize: number,
  period: number
): number;
