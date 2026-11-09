import type { CommonOptions, LayerHandle } from './common.js';
export type Uniform = number | string | { degrees: number };
export interface ShaderOptions extends CommonOptions {
  source: string;
  uniforms?: Record<string, Uniform>;
  /** Named independent clocks and their speeds. */
  times?: Record<string, number>;
  startTime?: number | 'random';
  seed?: number | string;
}
export function mount(
  canvas: HTMLCanvasElement,
  options: ShaderOptions
): LayerHandle<ShaderOptions>;
