/// <reference lib="dom" />

import type { RawValue } from '@link-foundation/ui-core';
import type { KindSpec } from '@link-foundation/ui-dom';

// ---------------------------------------------------------------- geometry

export interface LinkPoint {
  x: number;
  y: number;
}

/** One cubic Bézier segment of a link path. */
export interface CubicSegment {
  p0: LinkPoint;
  c1: LinkPoint;
  c2: LinkPoint;
  p3: LinkPoint;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface LinkGeometry {
  /** The link from the source to the target. */
  path: CubicSegment[];
  /** The point at half the arc length (the anchor). */
  center: LinkPoint;
  /** The arc length of the path. */
  length: number;
  /** The control points the spline passes through. */
  points: LinkPoint[];
  source: LinkPoint;
  target: LinkPoint;
  selfLoop: boolean;
}

export interface LinkGeometryOptions {
  source: LinkPoint;
  /** Without a target the link is a self-loop at the source. */
  target?: LinkPoint;
  /** How far the middle bends off the line, as a fraction of its length. */
  bend?: number;
  selfLoop?: boolean;
  loopRadius?: number;
}

/** The number of control points of a link (links-visuals). */
export const POINT_COUNT: 9;
export const DEFAULT_LOOP_RADIUS: number;

export function linkGeometry(options: LinkGeometryOptions): LinkGeometry;
/** The point at a fraction `t` (0…1) of the arc length. */
export function pointAtLength(
  path: readonly CubicSegment[],
  t: number
): LinkPoint;
/** The direction (radians) at a fraction `t` of the arc length. */
export function angleAtLength(path: readonly CubicSegment[], t: number): number;
/** The direction of travel at the start and at the end (radians). */
export function endAngles(path: readonly CubicSegment[]): {
  start: number;
  end: number;
};
export function cubicPoint(s: CubicSegment, t: number): LinkPoint;
export function cubicDerivative(s: CubicSegment, t: number): LinkPoint;
export function segmentLength(s: CubicSegment, t?: number): number;
export function pathLength(path: readonly CubicSegment[]): number;
export function catmullRomTangents(points: readonly LinkPoint[]): LinkPoint[];
export function catmullRomToCubics(
  points: readonly LinkPoint[]
): CubicSegment[];
export function controlPoints(
  source: LinkPoint,
  target: LinkPoint,
  bend?: number
): LinkPoint[];
export function selfLoopPoints(anchor: LinkPoint, radius?: number): LinkPoint[];
export function pathBounds(path: readonly CubicSegment[]): Bounds;
export function pathToSvgD(path: readonly CubicSegment[]): string;

// ----------------------------------------------------------------- markers

export type MarkerShape = 'bar' | 'arrow' | 'cross' | 'dot' | 'none';
export type LinkEnd = 'source' | 'target';

/** A marker shape as data, shared by the SVG and the Canvas renderer. */
export interface Marker {
  readonly id: MarkerShape;
  /** Always `0 0 100 100`. */
  readonly viewBox: string;
  /** SVG path data in the box (empty for `none`). */
  readonly path: string;
  readonly refX: number;
  readonly refY: number;
  readonly paint: 'stroke' | 'fill';
  /** In box units (one line width). */
  readonly strokeWidth: number;
  /** How the end is announced. */
  readonly label: string;
}

export const MARKERS: Readonly<Record<MarkerShape, Readonly<Marker>>>;
export const MARKER_IDS: readonly MarkerShape[];
export const MARKER_BOX: 100;
export const DEFAULT_ENDS: Readonly<{ source: 'bar'; target: 'arrow' }>;

export function getMarker(id: string): Readonly<Marker> | undefined;
export function markerElementId(
  prefix: string,
  end: LinkEnd,
  shape: string
): string;
/** `<marker>` elements for the two ends (no `<defs>` around them). */
export function svgMarkerDefs(
  ends: Partial<Record<LinkEnd, string>>,
  colors: Readonly<Record<string, string>>,
  options?: { idPrefix?: string }
): string;
/** Draw a marker on a canvas; whether anything was drawn. */
export function drawMarker(
  ctx: CanvasRenderingContext2D,
  marker: Readonly<Marker>,
  at: LinkPoint,
  angle: number,
  scale: number,
  options?: { color?: string; Path2D?: typeof Path2D }
): boolean;

// ------------------------------------------------------------------ tokens

export type ColorRole =
  | 'background'
  | 'line'
  | 'source'
  | 'target'
  | 'gridMinor'
  | 'gridMajor'
  | 'blueprintStart'
  | 'blueprintEnd'
  | 'blueprintCenter'
  | 'blueprintPoint'
  | 'blueprintGuide'
  | 'focus';

export type LinkColors = Readonly<Record<ColorRole, string>>;

/** The ui-tokens Links Notation of the `link-view` theme (light and dark). */
export const LINK_TOKENS: string;
export const COLOR_TOKENS: Readonly<Record<ColorRole, string>>;
export function linkColors(options?: {
  mode?: 'light' | 'dark' | null;
  tokens?: string;
}): LinkColors;
export function colorVariables(
  prefix?: string
): Readonly<Record<ColorRole, string>>;

// ------------------------------------------------------------------- scene

/** `screen = world · k + (x, y)`. */
export interface View {
  x: number;
  y: number;
  k: number;
}

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface LinkStyle {
  /** In CSS pixels. */
  width: number;
  height: number;
  view?: View;
  colors: LinkColors | Readonly<Record<string, string>>;
  ends?: Partial<Record<LinkEnd, string>>;
  blueprint?: boolean;
  grid?: boolean;
  gridSpacing?: number;
  /** World units (default from the grid step). */
  lineWidth?: number;
  /** Makes the SVG marker ids unique on a page. */
  idPrefix?: string;
  /** Canvas pixels per CSS pixel. */
  pixelRatio?: number;
}

export interface SceneEnd {
  end: LinkEnd;
  shape: string;
  at: LinkPoint;
  angle: number;
  color: string;
}

export interface Scene {
  width: number;
  height: number;
  view: View;
  background: string;
  grid: {
    minor: Segment[];
    major: Segment[];
    minorColor: string;
    majorColor: string;
    minorWidth: number;
    majorWidth: number;
  } | null;
  line: { path: CubicSegment[]; width: number; color: string };
  ends: [SceneEnd, SceneEnd];
  blueprint: {
    radius: number;
    strokeWidth: number;
    dash: readonly number[];
    guide: { points: LinkPoint[]; color: string; width: number };
    points: {
      at: LinkPoint;
      role: 'start' | 'end' | 'center' | 'point';
      color: string;
    }[];
  } | null;
}

export const GRID_SPACING: number;
export const STROKE_FRACTION: number;
export const RADIUS_FRACTION: number;
export const BLUEPRINT_DASH: readonly [4, 2];

export function buildScene(geometry: LinkGeometry, style: LinkStyle): Scene;
export function gridLines(
  area: Bounds,
  spacing: number,
  k: number
): { minor: Segment[]; major: Segment[] };
export function visibleArea(view: View, width: number, height: number): Bounds;
export function sceneBounds(
  geometry: LinkGeometry,
  options?: { gridSpacing?: number }
): Bounds;
export function fitView(
  bounds: Bounds,
  width: number,
  height: number,
  limits?: { min?: number; max?: number }
): View;

// --------------------------------------------------------------- renderers

/** The SVG of one link; the same input always gives the same text. */
export function renderLinkSvg(geometry: LinkGeometry, style: LinkStyle): string;
/** The marker shapes a scene draws (source, target). */
export function drawnMarkers(scene: Scene): string[];
export function drawLinkCanvas(
  ctx: CanvasRenderingContext2D,
  geometry: LinkGeometry,
  style: LinkStyle & { Path2D?: typeof Path2D }
): { markers: string[] };

// --------------------------------------------------------------- zoom-pan

export interface ZoomPanOptions {
  /** The smallest zoom (default 0.1). */
  min?: number;
  /** The largest zoom (default 20). */
  max?: number;
  /** Default `{x: 0, y: 0, k: 1}`. */
  initial?: Partial<View>;
  onChange?: (view: View, cause: string) => void;
  /** Zoom with the wheel (default true). */
  wheel?: boolean;
  /** Traces every event (off by default). */
  debug?: (message: string, data?: object) => void;
}

export interface ZoomPan {
  get(): View;
  /** The zoom is clamped. */
  set(view: Partial<View>): View;
  reset(): View;
  /** The pivot stays in place (default: the middle of the element). */
  zoomBy(factor: number, pivot?: LinkPoint): View;
  panBy(dx: number, dy: number): View;
  /** Removes every listener. */
  destroy(): void;
}

export function createZoomPan(
  element: HTMLElement,
  options?: ZoomPanOptions
): ZoomPan;
/** `0.999 ** delta`. */
export function wheelFactor(delta: number): number;
export function wheelDelta(event: {
  deltaY: number;
  deltaMode?: number;
}): number;

// ---------------------------------------------------------------- animator

export interface Frame {
  /** `now()` of this frame. */
  time: number;
  /** Since the animation started. */
  elapsed: number;
  /** Reduced motion: the only call, go to the end. */
  reduced: boolean;
}

/** Return `true` to be called again on the next frame. */
export type Step = (frame: Frame) => boolean | void;

export interface AnimatorOptions {
  now?: () => number;
  raf?: (callback: (time: number) => void) => unknown;
  caf?: (handle: unknown) => void;
  reducedMotion?: () => boolean;
  onError?: (error: unknown, id: string) => void;
}

export interface Animator {
  /** Replaces a running animation of the same id. */
  start(id: string, step: Step): void;
  stop(id: string): boolean;
  isRunning(id?: string): boolean;
  destroy(): void;
}

export function createAnimator(options?: AnimatorOptions): Animator;
export function prefersReducedMotion(win?: {
  matchMedia?: (query: string) => { matches: boolean };
}): boolean;

// ------------------------------------------------------------------- model

export interface LinkViewModel {
  /** The id of the `link-view` element. */
  readonly name: string | null;
  /** The link id. */
  readonly id: string | null;
  /** `null` is a free end. */
  readonly source: string | null;
  readonly target: string | null;
  readonly ends: Readonly<Record<LinkEnd, string>>;
  readonly blueprint: boolean;
  readonly grid: boolean;
  readonly bend: number;
  /** An explicit accessible name. */
  readonly label: string | null;
  readonly selfLoop: boolean;
}

export interface ModelDiagnostic {
  code: string;
  severity: 'error' | 'warning';
  message: string;
}

export const FREE_END_MARKER: 'cross';
export function readLinkView(
  raw: readonly RawValue[],
  options?: { name?: string | null }
): { model: LinkViewModel; diagnostics: ModelDiagnostic[] };
export function parseLinkView(text: string): {
  model: LinkViewModel;
  diagnostics: ModelDiagnostic[];
};
/** `Link 1 from 1 to 2`, or the label. */
export function accessibleName(model: LinkViewModel): string;

// ---------------------------------------------------------------- element

export interface LinkViewOptions {
  tag?: string;
  /** Clock and frame scheduler of every element of the tag. */
  animator?: AnimatorOptions;
  zoom?: { min?: number; max?: number };
}

export interface LinkViewDrawn {
  readonly renderer: 'svg' | 'canvas';
  readonly markers: readonly string[];
  readonly view: View;
}

/** The `<link-view>` element. */
export interface LinkViewElement extends HTMLElement {
  readonly model: LinkViewModel;
  readonly diagnostics: ModelDiagnostic[];
  lino: string | null;
  links: { raw: readonly RawValue[]; name?: string | null } | null;
  /** The zoom and pan of this element, relative to the fitted view. */
  view: View;
  readonly drawn: LinkViewDrawn | null;
  zoomBy(factor: number, pivot?: LinkPoint): View | undefined;
  resetView(): View | undefined;
  /** Draw on the next frame (several requests draw once). */
  requestDraw(): void;
  draw(): void;
}

export const LINK_VIEW_TAG: 'link-view';
export const LINK_VIEW_ATTRIBUTES: readonly string[];
export const KEY_ZOOM_STEP: number;
export const KEY_PAN_STEP: number;
export const FALLBACK_SIZE: Readonly<{ width: number; height: number }>;

export function linkViewGeometry(
  model: LinkViewModel,
  options?: { gridSpacing?: number }
): LinkGeometry;
export function defineLinkView(
  win?: Window & typeof globalThis,
  options?: LinkViewOptions
): { new (): LinkViewElement; prototype: LinkViewElement };
export function linkViewKind(options?: { tag?: string }): KindSpec;
export function registerLinkViewKind(
  win?: Window & typeof globalThis,
  options?: LinkViewOptions
): Readonly<KindSpec>;

// --------------------------------------------------------- links network
export type NetworkId = string | number;
export interface NetworkLink {
  id: NetworkId;
  source: NetworkId | 0;
  target: NetworkId | 0;
  label?: string;
}
export interface Network {
  points: Map<NetworkId, { id: NetworkId }>;
  links: Map<NetworkId, NetworkLink>;
}
export type NetworkPositions = Map<NetworkId, LinkPoint>;
export interface NetworkLayoutOptions {
  width?: number;
  height?: number;
  alphaMin?: number;
  maxTicks?: number;
  pins?: [NetworkId, LinkPoint][];
}
export type NetworkLayoutName =
  | 'circle'
  | 'grid'
  | 'hex'
  | 'spiral'
  | 'force'
  | 'layered';
export type NetworkLayout = (
  network: Network,
  options?: NetworkLayoutOptions
) => NetworkPositions;
export function buildNetwork(links: Iterable<NetworkLink>): Network;
export function networkIds(network: Network): NetworkId[];
export function networkEdges(
  network: Network
): { source: NetworkId; target: NetworkId }[];
export function networkNeighbours(network: Network, id: NetworkId): NetworkId[];
export const NETWORK_LAYOUTS: Readonly<
  Record<NetworkLayoutName, NetworkLayout>
>;
export const circle: NetworkLayout;
export const grid: NetworkLayout;
export const hex: NetworkLayout;
export const spiral: NetworkLayout;
export const force: NetworkLayout;
export const layered: NetworkLayout;
export function createForceSimulation(
  network: Network,
  options?: NetworkLayoutOptions
): {
  readonly ticks: number;
  tick(): boolean;
  positions(): NetworkPositions;
};
export interface NetworkLabel {
  id: NetworkId;
  x: number;
  y: number;
  width: number;
  height: number;
  priority?: number;
}
export function visibleLabels(
  labels: NetworkLabel[],
  zoom: number,
  options?: { minZoom?: number; padding?: number }
): NetworkId[];
export interface LayoutJob {
  layout: NetworkLayoutName;
  links: NetworkLink[];
  options?: NetworkLayoutOptions;
}
export interface LayoutResult {
  positions: NetworkPositions;
  ticks?: number;
}
export interface LayoutRunner {
  run(key: string, job: LayoutJob): Promise<LayoutResult>;
  cancel(key: string): void;
  dispose(): void;
}
export function createLayoutRunner(options?: {
  createWorker?: () => Worker;
}): LayoutRunner;
export interface NetworkStyle {
  width?: number;
  height?: number;
  view?: View;
  colors?: LinkColors;
  style?: 'glyph' | 'node-edge';
  selected?: NetworkId[];
  hovered?: NetworkId | null;
  labels?: { minZoom?: number; padding?: number };
}
export function networkToSvg(
  network: Network,
  positions: NetworkPositions,
  style?: NetworkStyle
): string;
export function networkToPng(svg: string, scale?: number): Promise<Blob>;
export interface NetworkStore {
  get(id: string):
    | {
        id: string;
        kind: string | null;
        positional: readonly RawValue[];
        properties: readonly { name: string; values: readonly RawValue[] }[];
      }
    | undefined;
  roots(): readonly string[];
  children(id: string): readonly string[];
  subscribe(
    listener: (
      events: readonly { id: string; type: string; before: unknown }[]
    ) => void
  ): () => void;
}
export interface LinksNetworkElement extends HTMLElement {
  items: NetworkLink[];
  store: NetworkStore | null;
  links: { raw: readonly RawValue[] };
  readonly network: Network;
  positions: NetworkPositions;
  readonly pins: NetworkPositions;
  readonly selection: NetworkId[];
  select(id: NetworkId | null, additive?: boolean): void;
  readonly ready: Promise<void>;
  readonly diagnostics: { severity: string; message: string }[];
  view: View;
  readonly drawn: {
    renderer: 'svg' | 'canvas';
    links: number;
    view: View;
  } | null;
  layout(): Promise<void>;
  requestDraw(): void;
  toSvg(): string;
  toPng(scale?: number): Promise<Blob>;
}
export interface LinksNetworkOptions {
  tag?: string;
  animator?: AnimatorOptions;
  createWorker?: () => Worker;
}
export const LINKS_NETWORK_TAG: 'links-network';
export function defineLinksNetwork(
  win?: Window & typeof globalThis,
  options?: LinksNetworkOptions
): { new (): LinksNetworkElement; prototype: LinksNetworkElement };
export function linksNetworkKind(options?: { tag?: string }): KindSpec;
export function registerLinksNetworkKind(
  win?: Window & typeof globalThis,
  options?: LinksNetworkOptions
): Readonly<KindSpec>;

export function networkVocabulary(): import('@link-foundation/ui-core').Vocabulary;
