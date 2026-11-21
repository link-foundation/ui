import type {
  CommonOptions,
  LayerHandle,
  GridCoordinates,
  RandomSource,
} from './common.js';
export interface BeamOptions extends CommonOptions, GridCoordinates {
  seed?: number | string;
  random?: RandomSource;
  style?: 'comet' | 'segment' | 'pulse' | 'scan';
  direction?: 'horizontal' | 'vertical' | 'both';
  bothSenses?: boolean;
  count?: number;
  speed?: number;
  length?: number;
  width?: number;
  color?: string;
  glow?: number;
  pause?: number;
  snap?: boolean;
}
export function mount(
  canvas: HTMLCanvasElement,
  options?: BeamOptions
): LayerHandle<BeamOptions>;
