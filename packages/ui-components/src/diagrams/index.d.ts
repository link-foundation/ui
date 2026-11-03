/// <reference lib="dom" />

import type { Link } from 'links-notation';

export type DiagramKind = 'flowchart' | 'sequence' | 'state' | 'class';
export type DiagramDirection = 'down' | 'up' | 'right' | 'left';
export type NodeShape =
  | 'box'
  | 'round'
  | 'stadium'
  | 'circle'
  | 'diamond'
  | 'start'
  | 'end';
export type DiagramRenderer = 'svg' | 'mermaid';

export interface DiagramNode {
  id: string;
  /** The text shown (defaults to the id). */
  label: string;
  shape: NodeShape;
  /** The id of the group the node is in. */
  group: string | null;
}

export interface DiagramEdge {
  /** Given, or `edge-N` (N counts the edges from 1). */
  id: string;
  from: string;
  to: string;
  label: string | null;
}

export interface DiagramGroup {
  id: string;
  label: string;
  /** The id of the enclosing group. */
  group: string | null;
}

export interface DiagramModel {
  id: string;
  kind: DiagramKind;
  direction: DiagramDirection;
  /** An accessible title (optional). */
  label: string | null;
  /** `null`: the default renderer of the kind. */
  renderer: DiagramRenderer | null;
  /** A registered layout name (`null`: dagre). */
  layout: string | null;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  groups: DiagramGroup[];
}

export const DIAGRAM_KINDS: readonly DiagramKind[];
export const DIAGRAM_DIRECTIONS: readonly DiagramDirection[];
export const NODE_SHAPES: readonly NodeShape[];
export const DIAGRAM_RENDERERS: readonly DiagramRenderer[];

export type DiagramErrorCode =
  | 'no-diagram'
  | 'unknown-node'
  | 'unknown-group'
  | 'duplicate-id'
  | 'invalid-value'
  | 'unknown-property'
  | 'missing-value';

/** Where an error is: the diagram, the index path of the link, its text. */
export interface DiagramErrorPosition {
  diagram: string | null;
  /** `[index of the diagram link in the document, index of the child]`. */
  path: number[];
  link: string;
}

export class DiagramError extends Error {
  constructor(
    code: DiagramErrorCode,
    message: string,
    at: DiagramErrorPosition
  );
  readonly code: DiagramErrorCode;
  readonly at: DiagramErrorPosition;
}

export function foldLink(link: Link): Link;
export function diagramsFromLinks(links: Link[]): DiagramModel[];
export function diagramFromLinks(links: Link[]): DiagramModel;
export function parseDiagram(text: string): DiagramModel;
export function diagramToLino(model: DiagramModel): string;
export function describeDiagram(model: DiagramModel): {
  nodes: string[];
  edges: string[];
};

export interface Size {
  width: number;
  height: number;
}

/** `x`, `y`: the centre of the box. */
export interface Box extends Size {
  id: string;
  x: number;
  y: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface EdgeLayout {
  id: string;
  /** From the source border to the target border. */
  points: Point[];
  /** The centre of the label. */
  labelAt: Point | null;
}

export interface Layout {
  width: number;
  height: number;
  nodes: Box[];
  edges: EdgeLayout[];
  groups: Box[];
}

export interface LayoutOptions {
  nodeSize?: Size | ((node: DiagramNode) => Size);
  rankSep?: number;
  nodeSep?: number;
  margin?: number;
}

export type LayoutEngine = (
  model: DiagramModel,
  options: Record<string, unknown>
) => Layout | Promise<Layout>;

export function estimateNodeSize(
  node: Pick<DiagramNode, 'label' | 'shape'>
): Size;
export function edgeLabelSize(label: string | null): Size;
export function layoutDiagram(
  model: DiagramModel,
  options?: LayoutOptions
): Layout;

export const DEFAULT_LAYOUT: 'dagre';
export function registerLayout(name: string, engine: LayoutEngine): void;
export function unregisterLayout(name: string): boolean;
export function registeredLayouts(): string[];
export function runLayout(
  model: DiagramModel,
  options?: Record<string, unknown>,
  name?: string
): Promise<Layout>;

export interface DiagramTokens {
  surface?: string;
  onSurface?: string;
  edge?: string;
  group?: string;
  groupOutline?: string;
  accent?: string;
  fontFamily?: string;
  /** In px. */
  fontSize?: number;
}

export const DEFAULT_DIAGRAM_TOKENS: Readonly<Required<DiagramTokens>>;
export const SVG_KINDS: readonly DiagramKind[];
export function escapeXml(text: string): string;
export function diagramSummary(model: DiagramModel): string;
export function renderDiagramSvg(
  model: DiagramModel,
  layout: Layout,
  tokens?: DiagramTokens & { idPrefix?: string }
): string;

export function escapeMermaidLabel(text: string): string;
export function toMermaid(model: DiagramModel): string;

export interface MermaidApi {
  initialize(config: object): void;
  render(id: string, text: string): Promise<{ svg: string }>;
}

export const MERMAID_CONFIG: Readonly<{
  startOnLoad: false;
  securityLevel: 'strict';
}>;
export function setMermaidImporter(
  importer: (() => Promise<unknown>) | null
): void;
export function loadMermaid(): Promise<MermaidApi>;
export function renderMermaid(source: string): Promise<string>;

export type DiagramState = 'loading' | 'ready' | 'error';

/** `<ui-mermaid-view>`: Mermaid text drawn by the lazily loaded Mermaid. */
export interface MermaidViewElement extends HTMLElement {
  source: string;
  readonly label: string;
  refresh(): Promise<DiagramState>;
}

/** `<ui-diagram>`: a diagram written in Links Notation. */
export interface DiagramElement extends HTMLElement {
  source: string;
  layoutOptions: LayoutOptions & Record<string, unknown>;
  tokens: DiagramTokens;
  readonly model: DiagramModel | null;
  refresh(): Promise<DiagramState>;
}

export function defineMermaidView(win?: Window): CustomElementConstructor;
export function defineDiagram(win?: Window): CustomElementConstructor;
export function pickRenderer(
  model: DiagramModel,
  override?: string | null
): DiagramRenderer;
