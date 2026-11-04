export type Corner =
  | 'square'
  | 'cut'
  | 'tall'
  | 'wide'
  | 'round'
  | 'scoop'
  | 'notch';
export type Line = 'none' | 'gap' | 'line' | 'accent' | 'bracket';
export const corners: Corner[];
export const lines: Line[];
/** Returns style-rule LiNo. Size is 0–48 percent, or pixels for round corners. */
export function frameStyle(options?: {
  corner?: Corner;
  line?: Line;
  size?: number;
}): string;
