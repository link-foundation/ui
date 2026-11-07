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

export type FrameLevel =
  | 'panel'
  | 'control'
  | 'button'
  | 'field'
  | 'tab'
  | 'chip'
  | 'menu'
  | 'nav'
  | 'subnav'
  | 'table';
export type FrameCornerName =
  | 'top-left'
  | 'top-right'
  | 'bottom-right'
  | 'bottom-left';
export type FrameEdgeName = 'top' | 'right' | 'bottom' | 'left';
export type FrameState = 'hover' | 'active' | 'selected' | 'focus' | 'disabled';
export interface FrameCorner {
  shape: Corner;
  size: number;
  width?: number;
  height?: number;
  stroke: number;
  color: string;
}
export interface FrameEdge {
  line: Line;
  stroke: number;
  color: string;
  gap: number;
}
export interface ResolvedFrame {
  corners: Record<FrameCornerName, FrameCorner>;
  edges: Record<FrameEdgeName, FrameEdge>;
}
export interface FrameDefinition {
  extends?: FrameLevel;
  corners: Partial<Record<FrameCornerName, Partial<FrameCorner>>>;
  edges: Partial<Record<FrameEdgeName, Partial<FrameEdge>>>;
  states: Partial<Record<FrameState, FrameDefinition>>;
}
export const FRAME_LEVELS: FrameLevel[];
export const FRAME_CORNERS: FrameCornerName[];
export const FRAME_EDGES: FrameEdgeName[];
export function readFrames(text: string): Map<FrameLevel, FrameDefinition>;
export function resolveFrame(
  frames: Map<FrameLevel, FrameDefinition>,
  level: FrameLevel,
  states?: FrameState[]
): ResolvedFrame;
export function frameGeometry(
  frame: ResolvedFrame,
  width: number,
  height: number
): {
  path: string;
  clipPath: string;
  corners: Record<
    FrameCornerName,
    FrameCorner & { width: number; height: number }
  >;
  borderSvg: string;
};
