import type { ShaderOptions, Uniform } from './shader.js';
export const source: string;
export const uniforms: Record<string, Uniform>;
export function nebula(
  options?: Partial<ShaderOptions> & {
    driftSpeed?: number;
    twinkleSpeed?: number;
  }
): ShaderOptions;
