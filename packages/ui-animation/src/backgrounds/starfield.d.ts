import type { CommonOptions, LayerHandle } from './common.js';
export interface StarfieldOptions extends CommonOptions {
  seed?: number | string;
  count?: number;
  shape?:
    | 'dot'
    | 'soft-dot'
    | 'ring'
    | 'square'
    | 'diamond'
    | 'cross'
    | 'cross-x'
    | 'star-4'
    | 'star-5'
    | 'star-6'
    | 'sparkle'
    | 'telescope-flare';
  size?: number;
  sizeSpread?: number;
  color?: string;
  hueSpread?: number;
  brightness?: number;
  glow?: number;
  glowColor?: string;
  twinkleRate?: number;
  twinkleDepth?: number;
  rotation?: number;
  spin?: number;
  motion?: 'still' | 'drift' | 'warp' | 'orbit';
  direction?: number;
  speed?: number;
  streak?: number;
  blend?: 'normal' | 'add' | 'screen';
}
export function mount(
  canvas: HTMLCanvasElement,
  options?: StarfieldOptions
): LayerHandle<StarfieldOptions>;
