import type { CommonOptions, LayerHandle } from './common.js';
export interface RainOptions extends CommonOptions {
  seed?: number | string;
  cellSize?: number;
  step?: number;
  columnSteps?: number;
  density?: number;
  restart?: number;
  fade?: number;
  glow?: number;
  padding?: number;
  color?: string;
  visible?: boolean;
  drift?: number;
  pick?: () => unknown;
  paint?: (
    ctx: CanvasRenderingContext2D,
    glyph: unknown,
    x: number,
    y: number,
    size: number,
    glow: number
  ) => void;
}
export function mount(
  canvas: HTMLCanvasElement,
  options?: RainOptions
): LayerHandle<RainOptions>;
export function createCadence(): {
  frame(gap: number): void;
  ready(step: number, fps: number): boolean;
  reset(): void;
};
