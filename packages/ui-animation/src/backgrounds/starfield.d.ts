import type { CommonOptions, LayerHandle, RandomSource } from './common.js';
export interface StarLayoutPoint {
  /** Position relative to the CSS width and height. */
  x: number;
  y: number;
  depth?: number;
  phase?: number;
  size?: number;
  sprite?: number;
  /** Optional authored scale, alpha and angle in degrees. */
  scale?: number;
  opacity?: number;
  rotation?: number;
}
export interface StarSprite {
  image: CanvasImageSource;
  /** Destination size in CSS pixels before applying the star's scale. */
  size: number;
}
export interface StarfieldOptions extends CommonOptions {
  seed?: number | string;
  random?: RandomSource;
  count?: number;
  layout?: (input: {
    count: number;
    width: number;
    height: number;
    dpr: number;
    random: () => number;
    options: StarfieldOptions;
  }) => readonly StarLayoutPoint[];
  createSprites?: (input: {
    canvas: HTMLCanvasElement;
    dpr: number;
    options: StarfieldOptions;
  }) => readonly StarSprite[];
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
