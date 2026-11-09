/// <reference lib="dom" />

import type { Link } from 'links-notation';

/** The marks of a chart. */
export type Mark =
  | 'line'
  | 'area'
  | 'bar'
  | 'point'
  | 'arc'
  | 'calendar'
  | 'range'
  | 'composition';
/** The type of a field (as in Vega-Lite). */
export type FieldType = 'quantitative' | 'temporal' | 'ordinal' | 'nominal';
/** How a chart is drawn. */
export type Renderer = 'svg' | 'echarts';

/** A field of the data on a channel. */
export interface FieldDef {
  /** The data field. */
  scale?: { type: 'log'; base?: number };
  field: string;
  type: FieldType;
  /** The axis or legend title (default: the field). */
  title: string | null;
}

export interface MarkDef {
  type: Mark;
  /** The line and area curve. */
  interpolate: 'linear' | 'monotone' | 'step';
  /** Draw a point on every value of a line or area. */
  point: boolean;
  /** The hole of an arc (a donut), in pixels. */
  innerRadius: number;
}

export interface Encoding {
  x?: FieldDef;
  x2?: FieldDef;
  y?: FieldDef;
  theta?: FieldDef;
  color?: FieldDef;
  size?: FieldDef;
  tooltip?: FieldDef[];
}

/** A `(NAME: chart (data ...) (mark ...) (encoding ...))` spec. */
export interface ChartSpec {
  kind: 'chart';
  cornerRadius?: number;
  labels?: 'peaks' | 'last';
  emphasis?: string;
  topN?: number;
  weekStart?: number;
  thresholds?: number[];
  /** Snapshot end for ongoing rows; default: next year after latest data date. */
  ongoingEnd?: string;
  tooltip?: {
    layer?: 'top' | 'inline';
    content?: (datum: Record<string, string | number>) => {
      title?: string;
      value?: string | number;
      rows?: [string, string | number][];
    };
  };
  id: string | null;
  title: string | null;
  description: string | null;
  renderer: Renderer;
  width: number | null;
  height: number | null;
  mark: MarkDef;
  /** The typed rows. */
  data: { values: Record<string, string | number>[] };
  encoding: Encoding;
}

export interface GaugeSpec {
  kind: 'gauge';
  id: string | null;
  label: string | null;
  description: string | null;
  value: number;
  /** Default 0. */
  min: number;
  /** Default 100. */
  max: number;
  unit: string | null;
}

export interface StatTileSpec {
  kind: 'stat-tile';
  notation?: 'compact';
  compactThreshold?: number;
  hint?: string;
  footnote?: { label: string; href: string };
  id: string | null;
  label: string | null;
  description: string | null;
  value: number;
  unit: string | null;
  /** The change, in percent. */
  delta: number | null;
  /** Recent values, drawn as a sparkline. */
  trend: number[];
}

export interface SparklineSpec {
  kind: 'sparkline';
  id: string | null;
  label: string | null;
  description: string | null;
  values: number[];
  mark: 'line' | 'area' | 'bar';
}

export type SmallChartSpec = GaugeSpec | StatTileSpec | SparklineSpec;
export interface TagCloudSpec {
  kind: 'tag-cloud';
  id: string | null;
  label: string | null;
  description: string | null;
  minSize: number;
  maxSize: number;
  items: {
    name: string;
    count?: number | null;
    color?: string | null;
    emphasis?: boolean;
  }[];
}
export type AnyChartSpec = ChartSpec | SmallChartSpec | TagCloudSpec;

/**
 * Where a bad link is: the indexes from the top-level link down to it, and
 * its LiNo text.
 */
export interface LinkPosition {
  path: number[];
  link: string | null;
}

/** A spec that does not follow the chart dialect. */
export declare class ChartSpecError extends Error {
  constructor(code: string, reason: string, position: LinkPosition);
  readonly name: 'ChartSpecError';
  /** A stable machine-readable reason (`unknown-mark`). */
  readonly code: string;
  /** The human-readable reason. */
  readonly reason: string;
  /** The position of the bad link. */
  readonly path: number[];
  /** The LiNo text of the bad link. */
  readonly link: string | null;
}

export declare const MARKS: readonly Mark[];
export declare const FIELD_TYPES: readonly FieldType[];
export declare const CHANNELS: readonly string[];
export declare const RENDERERS: readonly Renderer[];
export declare const CHART_KINDS: readonly AnyChartSpec['kind'][];
export declare const SMALL_KINDS: readonly SmallChartSpec['kind'][];
export declare const SPARKLINE_MARKS: readonly SparklineSpec['mark'][];

/** Every chart of a list of links (a document may hold other elements). */
export declare function chartsFromLinks(links: readonly Link[]): AnyChartSpec[];
/** The first chart of a list of links. Throws ChartSpecError. */
export declare function chartFromLinks(links: readonly Link[]): AnyChartSpec;
/** Parse LiNo text with the official parser and read its first chart. */
export declare function parseChart(text: string): AnyChartSpec;
/** Write a spec as LiNo text; `chartFromLinks` reads it back equal. */
export declare function chartToLino(spec: AnyChartSpec): string;

/** Token path to colour, as an object or a Map. */
export type ChartTokenValues =
  | Record<string, string>
  | Map<string, string>
  | null;

export interface RenderOptions {
  width?: number;
  height?: number;
  /** Literal colours; by default the SVG uses CSS custom properties. */
  tokens?: ChartTokenValues;
}

/** A value a keyboard user can move to. */
export interface ChartPoint {
  /** The series index. */
  series: number;
  /** The index of the point in its series. */
  index: number;
  /** The index of the data row. */
  row: number;
  /** Navigation anchor, in SVG pixels. */
  x: number;
  y: number;
  datum: Record<string, string | number>;
  day?: number;
  /** The tooltip and announcement. */
  text: string;
}

export interface ChartSeries {
  /** The colour value, or null for a single series. */
  key: string | null;
  color: string;
  points: ChartPoint[];
  /** The marks: `{tag, attrs}`. */
  shapes: { tag: string; attrs: Record<string, string | number> }[];
}

export interface ChartLayout {
  width: number;
  height: number;
  title: string | null;
  weeks?: number;
  accessibleMarks: boolean;
  diagnostics: {
    code: string;
    channel: string;
    row: number;
    value: string | number;
    message: string;
  }[];
  /** The accessible name. */
  label: string;
  plot: { x: number; y: number; width: number; height: number };
  axes: object[];
  legend: {
    label: string;
    color: string;
    x: number;
    y: number;
    pattern?: 'solid' | 'hatched' | 'dotted';
  }[];
  series: ChartSeries[];
}

export declare const DEFAULT_WIDTH: number;
export declare const DEFAULT_HEIGHT: number;
/** The pixel layout of a chart: scales, marks, axes and points. */
export declare function layoutChart(
  spec: ChartSpec,
  options?: RenderOptions
): ChartLayout;
/** Deterministic SVG text: the same spec gives the same bytes. */
export declare function renderChartSvg(
  spec: AnyChartSpec,
  options?: RenderOptions
): string;

/** A sentence that describes the data of a chart. */
export declare function summarizeChart(spec: AnyChartSpec): string;
/** The accessible name: description, else title or label, else summary. */
export declare function chartLabel(spec: AnyChartSpec): string;
/** The data table twin of a chart. */
export declare function chartTable(spec: AnyChartSpec): {
  caption: string;
  columns: string[];
  numeric: boolean[];
  rows: string[][];
};

/** The number of series colours (`color.chart.1` … `color.chart.8`). */
export declare const SERIES_COUNT: number;
/** The chart colour tokens of the light and dark themes. */
export declare const CHART_TOKENS: Readonly<{
  light: Readonly<Record<string, string>>;
  dark: Readonly<Record<string, string>>;
}>;
/** The tokens as CSS custom properties (light, dark, `data-theme`). */
export declare const CHART_CSS: string;
/** The token of a series: `color.chart.<index % 8 + 1>`. */
export declare function seriesToken(index: number): string;
/** A literal colour from `tokens`, else a CSS variable with a fallback. */
export declare function tokenColor(
  path: string,
  tokens?: ChartTokenValues
): string;
/** The chart tokens as a `@link-foundation/ui-tokens` theme in LiNo. */
export declare function chartTokensLino(name?: string): string;

/** `type="text/lino"`: the script that holds a chart inside an element. */
export declare const LINO_SCRIPT_TYPE: string;
/** Add the chart styles to a document (once). */
export declare function ensureChartStyles(document: Document): void;

/** The base of the chart elements. */
export interface ChartElement extends HTMLElement {
  /** The LiNo text of the chart; setting it renders again. */
  lino: string | null;
  /** The normalised spec shown; setting it renders again. */
  spec: AnyChartSpec | null;
}

/**
 * `<ui-chart>`: an SVG `role="img"` named by the description, a table twin
 * behind "Show data table", and arrow-key navigation announced through
 * aria-live. Events: `chart-point` (detail: ChartPoint) and `chart-error`
 * (detail: ChartSpecError or the ECharts load error).
 */
export interface UiChartElement extends ChartElement {
  /** Resolves when the chart (and ECharts, if used) has rendered. */
  ready: Promise<void>;
  /** Replaces `import('echarts')` for `(renderer echarts)`. */
  loadECharts: (() => Promise<unknown>) | undefined;
  /** The point moved to with the keyboard or pointer, or null. */
  readonly activePoint: ChartPoint | null;
}

export declare const CHART_TAG: 'ui-chart';
export declare const GAUGE_TAG: 'ui-gauge';
export declare const SPARKLINE_TAG: 'ui-sparkline';
export declare const STAT_TILE_TAG: 'ui-stat-tile';

/** The `<ui-chart>` class of a window. */
export declare function createChartClass(win: Window): new () => UiChartElement;
/** Define `<ui-chart>` in a window, unless the tag is taken. */
export declare function defineChartElement(
  win?: Window
): CustomElementConstructor;
/** Define `<ui-gauge>` (attributes: label value min max unit). */
export declare function defineGaugeElement(
  win?: Window
): CustomElementConstructor;
/** Define `<ui-sparkline>` (attributes: label values mark). */
export declare function defineSparklineElement(
  win?: Window
): CustomElementConstructor;
/** Define `<ui-stat-tile>` (attributes: label value unit delta trend). */
export declare function defineStatTileElement(
  win?: Window
): CustomElementConstructor;
/** Define every chart element in a window (each once). */
export declare function defineChartElements(win?: Window): {
  chart: CustomElementConstructor;
  statTile: CustomElementConstructor;
  gauge: CustomElementConstructor;
  sparkline: CustomElementConstructor;
};
