import type {
  LinkPoint as Point,
  CubicSegment,
  NetworkPresentationProvider,
  NetworkPresentationFrame,
  NetworkLinkInput,
} from './index.js';

export type DoubletPair = readonly [number, number];
export type DoubletInput = readonly DoubletPair[] | readonly NetworkLinkInput[];
export type DoubletMarkerShape =
  | 'bar'
  | 'arrow'
  | 'triangle'
  | 'tail'
  | 'dot'
  | 'circle'
  | 'square'
  | 'diamond'
  | 'none';
export interface DoubletMarker {
  shape: DoubletMarkerShape;
  size: number;
  angle: number;
  offset: number;
  across: number;
  rotation: number;
  explicit: string[];
}
export interface DoubletOptions {
  layout:
    | 'auto'
    | 'circle'
    | 'grid'
    | 'hex'
    | 'spiral'
    | 'dice'
    | 'cards'
    | 'force'
    | 'layered';
  layoutAspect: number;
  columns: number;
  spread: number;
  rotation: number;
  free: number;
  loop: number;
  bulge: number;
  loopBend: number;
  angles: 'fixed' | 'mirror';
  sourceAngle: number;
  targetAngle: number;
  tension: number;
  gaps: number[];
  links: Record<number, { turns: number[]; gaps: (number | null)[] }>;
  order: number[] | null;
  frame: [number, number, number] | null;
  padding: number;
  start: DoubletMarker;
  end: DoubletMarker;
  middle: DoubletMarker;
  strokeWidth: number;
  color: string;
  dash: 'solid' | 'dashed' | 'dotted' | 'dashdot' | 'long';
  linecap: 'butt' | 'round' | 'square';
  opacity: number;
  glow: number;
  arrowJoin: 'miter' | 'round' | 'bevel';
  balanceArrows: boolean;
  background: {
    type: 'transparent' | 'solid' | 'linear' | 'radial';
    color: string;
    color2: string;
    angle: number;
  };
  card: {
    color: string;
    opacity: number;
    border: 'solid' | 'dashed' | 'dotted' | 'double' | 'none';
    borderColor: string;
    width: number;
    radius: number;
    inset: number;
  };
  caption: {
    mode: 'none' | 'theory' | 'pairs' | 'number' | 'links' | 'custom';
    text: string;
    font: 'mono' | 'sans' | 'serif';
    size: number;
    color: string;
  };
  width: number;
  height: number;
}
export interface DoubletMarkerPlacement {
  end: 'start' | 'end' | 'middle';
  marker: DoubletMarker;
  point: Point;
  anchor: Point;
  direction: Point;
  angle: number;
  compensated: boolean;
  extension: number;
  length: number;
}
export interface DoubletCurve {
  id: number;
  middle: Point;
  direction: Point;
  path: [CubicSegment, CubicSegment];
}
export interface FittedDoubletCurve extends DoubletCurve {
  visible: [CubicSegment | null, CubicSegment | null];
  gaps: number[];
  markers: DoubletMarkerPlacement[];
  lengths: number[];
}
export interface DoubletFrame extends NetworkPresentationFrame {
  places: Map<number, Point>;
  layoutCurves: DoubletCurve[];
  curves: FittedDoubletCurve[];
  pairs: DoubletPair[];
  options: DoubletOptions;
  index: string;
  transform: [number, number, number];
  margin: number;
  captionRoom: number;
}
export const DOUBLET_MARKERS: readonly DoubletMarkerShape[];
export function readDoubletOptions(
  text?: string,
  count?: number
): DoubletOptions;
export function doubletGeometry(
  items: DoubletInput,
  options?: string,
  index?: string
): DoubletFrame;
export function createDoubletProvider(options?: {
  debug?: (message: string, data: object) => void;
}): NetworkPresentationProvider;
export function doubletOptionAvailability(
  items: DoubletInput,
  options?: string
): Record<string, boolean>;
