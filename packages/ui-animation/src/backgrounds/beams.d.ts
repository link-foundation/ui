import type { CommonOptions, LayerHandle } from './common.js';
export interface BeamOptions extends CommonOptions {
  seed?: number | string;
  cellSize?: number;
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
  drift?: number;
}
export function mount(
  canvas: HTMLCanvasElement,
  options?: BeamOptions
): LayerHandle<BeamOptions>;
