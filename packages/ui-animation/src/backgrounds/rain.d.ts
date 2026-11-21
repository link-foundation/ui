import type {
  CommonOptions,
  LayerHandle,
  GridCoordinates,
  RandomSource,
} from './common.js';
export interface RainOptions extends CommonOptions, GridCoordinates {
  seed?: number | string;
  random?: RandomSource;
  step?: number;
  /** Batched calibration only changes after 30 valid gaps, using the upper median. */
  calibration?: 'rolling' | 'batched';
  columnSteps?: number;
  density?: number;
  restart?: number;
  fade?: number;
  glow?: number;
  padding?: number;
  color?: string;
  visible?: boolean;
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
export function createCadence(mode?: RainOptions['calibration']): {
  frame(gap: number): void;
  ready(step: number, fps: number): boolean;
  reset(): void;
};
