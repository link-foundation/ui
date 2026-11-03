/// <reference lib="dom" />

import type { UiNode, Vocabulary } from '@link-foundation/ui-core';

/* Layer manager */

export type Layer = 'base' | 'dock' | 'window' | 'popover' | 'modal' | 'toast';

/** The layers, lowest first. */
export const LAYERS: readonly Layer[];

export interface LayerManager {
  /** Add a surface to a layer (on top of it). */
  register(id: string, layer: Layer): void;
  /** Put a surface on top of its layer. */
  raise(id: string): void;
  /** The z-index of a surface; a higher layer is always above a lower one. */
  zIndexOf(id: string): number;
  layerOf(id: string): Layer | undefined;
  unregister(id: string): void;
  /** Called after every change; returns the unsubscribe function. */
  subscribe(listener: () => void): () => void;
  /** The surfaces, lowest first. */
  order(): string[];
}

export function createLayerManager(options?: {
  base?: number;
  step?: number;
}): LayerManager;

/* Split model */

export interface SplitLimits {
  min?: number | number[];
  max?: number | number[];
  collapsible?: boolean | boolean[];
}

export function resizeSplit(
  sizes: readonly number[],
  index: number,
  delta: number,
  limits?: SplitLimits
): number[];
export function collapsePane(
  sizes: readonly number[],
  index: number,
  limits?: SplitLimits
): number[];
export function restorePane(
  sizes: readonly number[],
  index: number,
  size: number,
  limits?: SplitLimits
): number[];
export function normalizeSizes(
  sizes: unknown,
  count: number,
  total?: number
): number[];
export function paneLimits(
  sizes: readonly number[],
  index: number,
  limits?: SplitLimits
): { min: number; max: number; collapsible: boolean };
export function sum(values: readonly number[]): number;

/** `(sizes 30 70)` of remembered split sizes. */
export function sizesToLino(sizes: readonly number[]): string;
/** The sizes of a `(sizes ...)` text; `null` when it is not one. */
export function sizesFromLino(text: string | null | undefined): number[] | null;
/** The current sizes of a rendered split. */
export function splitSizes(node: Element): number[];

/* Dock model */

export type Side = 'left' | 'right' | 'top' | 'bottom' | 'center';

export interface DockRegion {
  id: string;
  side: Side;
  /** A CSS length such as `16rem`. */
  size: string | null;
  collapsed: boolean;
  /** Panel ids in tab order. */
  panels: string[];
  /** The panel shown. */
  active: string | null;
}

export interface FloatingPanel {
  panel: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** The region it was floated from. */
  region: string | null;
}

export interface ClosedPanel {
  panel: string;
  /** The region it was closed in. */
  region: string | null;
}

export interface DockLayout {
  id: string | null;
  /** The storage key of the layout. */
  persist: string | null;
  regions: DockRegion[];
  floating: FloatingPanel[];
  closed: ClosedPanel[];
}

export type PanelPlace =
  | { place: 'region'; region: DockRegion; index: number }
  | { place: 'floating'; floating: FloatingPanel; index: number }
  | { place: 'closed'; closed: ClosedPanel; index: number };

export const SIDES: readonly Side[];
export const FLOAT_DEFAULTS: Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export function dockLayoutFromNode(node: UiNode): DockLayout;
export function dockLayoutFromLinks(
  links: string | object | object[],
  options?: { id?: string }
): DockLayout;
export function dockLayoutToLino(
  layout: DockLayout,
  options?: { indent?: string }
): string;
export function findPanel(
  layout: DockLayout,
  panelId: string
): PanelPlace | null;
export function panelIds(layout: DockLayout): string[];
export function openPanelIds(layout: DockLayout): string[];
export function movePanel(
  layout: DockLayout,
  panelId: string,
  target: string | { region: string; index?: number; activate?: boolean }
): DockLayout;
export function floatPanel(
  layout: DockLayout,
  panelId: string,
  rect?: { x?: number; y?: number; width?: number; height?: number }
): DockLayout;
export function closePanel(layout: DockLayout, panelId: string): DockLayout;
export function restorePanel(
  layout: DockLayout,
  panelId: string,
  target?: string | { region: string; index?: number }
): DockLayout;
export function activatePanel(layout: DockLayout, panelId: string): DockLayout;
export function updateRegion(
  layout: DockLayout,
  regionId: string,
  change: { size?: string | null; collapsed?: boolean }
): DockLayout;
/** The current layout of a rendered dock. */
export function dockLayout(node: Element): DockLayout | null;

/* Vocabulary */

export const LAYOUT_VOCABULARY_TEXT: string;
/** The ui-dialect vocabulary with the layout kinds. */
export function layoutVocabulary(): Vocabulary;

/* Rendered elements */

/** The options of the layout kinds: `render(container, store, { layout })`. */
export interface LayoutRenderOptions {
  /** Where `remember-size` and `persist` save (e.g. `localStorage`). */
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
  /** The layer manager of windows and floating panels. */
  layers?: LayerManager;
}

/** Write the flexbox styles of a stack element (the `changed` names). */
export function updateFlex(
  node: HTMLElement,
  el: object,
  changed: readonly string[],
  ctx: object
): void;
export function isTrackAtom(text: string): boolean;
/** The CSS track list of `columns` or `rows`. */
export function trackList(
  raws: readonly unknown[] | undefined
): string | null | undefined;
/** The `grid-template-areas` of `areas`. */
export function areaList(
  raws: readonly unknown[] | undefined
): { css: string; names: Set<string> } | null | undefined;

/** The selected panel id of a rendered tab group. */
export function activeTab(node: Element): string | null;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
/** A rectangle moved and sized to lie inside the viewport. */
export function clampRect(
  rect: Rect,
  viewport: { width: number; height: number }
): Rect;
export function viewportOf(document: Document): {
  width: number;
  height: number;
};
/** The controller of a rendered window. */
export function windowController(node: Element):
  | {
      show(focus: boolean): void;
      hide(): void;
      frame: { readonly rect: Rect; setRect(rect: Partial<Rect>): void };
    }
  | undefined;

export type ShellMode = 'bottom-bar' | 'rail' | 'drawer';
export const SHELL_MODES: readonly ShellMode[];
export const SHELL_BREAKPOINTS: readonly number[];
/** The mode of an app shell at a viewport width. */
export function shellMode(
  width: number,
  breakpoints?: readonly number[]
): ShellMode;
/** The mode of a rendered app shell. */
export function appShellMode(node: Element): ShellMode | null;
