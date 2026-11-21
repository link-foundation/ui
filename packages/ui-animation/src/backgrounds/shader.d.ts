import type { CommonOptions, LayerHandle, RandomSource } from './common.js';
export type Uniform = number | string | { degrees: number };
export interface ShaderOptions extends CommonOptions {
  source: string;
  uniforms?: Record<string, Uniform>;
  /** Named independent clocks and their speeds. */
  times?: Record<string, number>;
  startTime?: number | 'random' | Record<string, number | 'random'>;
  /** Host-owned clock values in seconds by uniform name. Update with a new map to seek. */
  clock?: Record<string, number>;
  seed?: number | string;
  random?: RandomSource;
}
export function mount(
  canvas: HTMLCanvasElement,
  options: ShaderOptions
): LayerHandle<ShaderOptions>;
