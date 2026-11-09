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
  | 'block'
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
  size: number | 'auto';
  width?: number | 'auto';
  height?: number | 'auto';
  line?: Line;
  arm?: number | 'auto';
  stroke: number | 'auto';
  color: string;
}
export type FrameEdgeStyle = 'solid' | 'dashed' | 'dotted' | 'double';
export interface FrameEdge {
  line: Line;
  style?: FrameEdgeStyle;
  stroke: number | 'auto';
  color: string;
  gap: number;
}
export interface FrameOptions {
  mode?: 'frame' | 'own' | 'border';
  layer?: 'above' | 'below';
  opacity?: number;
  style?: FrameEdgeStyle;
  stroke?: number | 'auto';
  'min-width'?: number;
  'max-width'?: number;
  'min-height'?: number;
  'max-height'?: number;
  fitScale?: number;
}
export interface ResolvedFrameCorner extends Omit<
  FrameCorner,
  'size' | 'width' | 'height' | 'arm' | 'stroke' | 'line'
> {
  size: number;
  width?: number;
  height?: number;
  arm: number;
  stroke: number;
  line: Line;
}
export interface ResolvedFrameEdge extends Omit<FrameEdge, 'stroke' | 'style'> {
  stroke: number;
  style: FrameEdgeStyle;
}
export interface ResolvedFrame extends FrameOptions {
  corners: Record<FrameCornerName, ResolvedFrameCorner>;
  edges: Record<FrameEdgeName, ResolvedFrameEdge>;
}
export interface FrameDefinition extends FrameOptions {
  extends?: FrameLevel;
  scale?: number;
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
    ResolvedFrameCorner & { width: number; height: number }
  >;
  borderSvg: string;
};

export interface FramesCssOptions {
  levels?: Partial<Record<FrameLevel, string[]>>;
  prefix?: string;
  scope?: string;
  boundaryAttribute?: string;
  selected?: string[];
}
export interface FrameControl {
  level: FrameLevel;
  property?: string;
  syntax?: string;
  inherits?: boolean;
  attribute?: string;
  choices?: string[];
}
export function framesCss(
  frames: Map<FrameLevel, FrameDefinition>,
  options?: FramesCssOptions
): {
  properties: string;
  base: string;
  levels: Partial<Record<FrameLevel, string>>;
  fit: string;
  controls: FrameControl[];
};
/** Insert first in a transparent, positioned frame host; content follows. */
export function frameLayers(): string;
