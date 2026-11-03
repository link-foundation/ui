/// <reference lib="dom" />

import type { Vocabulary } from '@link-foundation/ui-core';
import type {
  BehaviorHandle,
  BehaviorOptions,
} from '@link-foundation/ui-components/behavior/dom';

/* Control kinds */

export type ControlKind =
  | 'button'
  | 'icon-button'
  | 'label'
  | 'link'
  | 'text-field'
  | 'text-area'
  | 'number-field'
  | 'color-field'
  | 'checkbox'
  | 'radio-group'
  | 'radio'
  | 'switch'
  | 'slider'
  | 'select'
  | 'combobox'
  | 'option'
  | 'progress'
  | 'badge'
  | 'avatar';

/** The machine and the ARIA role of a control kind (`null` when none). */
export interface ControlKindMeta {
  machine: string | null;
  role: string | null;
}

/** The control kinds in Links Notation (`kinds.lino`). */
export const CONTROL_KINDS_TEXT: string;
/** The control kind names, in kinds.lino order. */
export function controlKindNames(): ControlKind[];
/** `undefined` for a kind that is not a control. */
export function controlKindMeta(kind: string): ControlKindMeta | undefined;
/** The ui-dialect vocabulary with the control kinds. */
export function controlsVocabulary(): Vocabulary;

/** The machine text of every stateful control, by kind. */
export const CONTROL_MACHINES: Readonly<Partial<Record<ControlKind, string>>>;
/** The ui-dom kind renderer of every control, by kind. */
export const CONTROL_KIND_SPECS: Readonly<Record<ControlKind, object>>;

/**
 * Register the control kinds with ui-dom (no target) or add them to a
 * kinds Map or object; returns the kind names.
 */
export function registerControls(
  target?: Map<string, object> | Record<string, object>
): ControlKind[];

/** The `detail` of the `ui-change` event a control dispatches. */
export interface ControlChange {
  source: string;
  property: string;
  value: string | null;
}

/**
 * Mount a document whose controls write every committed value to the
 * store (one `setProp`) before the `(on change ...)` handlers run.
 */
export function mountControls(
  container: Element,
  text: string,
  options?: BehaviorOptions & Record<string, unknown>
): BehaviorHandle;

/* Helpers */

/** The ID prefix of the control parts (`ui-control-<id>-<part>`). */
export const ID_PREFIX: string;
export function partId(id: string, part?: string): string;

export interface NumericRange {
  min?: number;
  max?: number;
  step?: number;
}

/** Round to the step from the minimum and clamp to the range. */
export function clampStep(value: number, range?: NumericRange): number;
/** The number of decimals of a finite number. */
export function decimalsOf(value: number): number;
/** The value a key moves a numeric control to; `null` for other keys. */
export function nextValue(
  key: string,
  state?: NumericRange & { value?: number; shift?: boolean; rtl?: boolean }
): number | null;
export function formatNumber(value: unknown): string;
export function readNumber(
  text: string,
  range?: NumericRange
): { value: number | null; invalid: false } | { invalid: true };
/** The fraction (0–1) of the range a value is at. */
export function fractionOf(
  value: number,
  range: { min: number; max: number }
): number;
/** The `value-text` template with `{value}` replaced, else the number. */
export function valueText(
  template: string | null | undefined,
  value: number
): string;
/** The normalised `#rrggbb` of a hex colour text, or `null`. */
export function formatHex(value: unknown): string | null;
export function parseHex(
  value: unknown
): { r: number; g: number; b: number } | null;
/** The initials of a name (first and last word). */
export function initialsOf(name: string): string;
/** Whether a link target looks like a URL rather than a bare word. */
export function isUrl(href: string): boolean;
/** Hide the options of a listbox whose label does not contain the text. */
export function filterOptions(listbox: Element, text: string): void;
export const BADGE_TONES: readonly ['neutral', 'primary', 'error'];

/* Stories and the catalog */

export interface StorySet {
  id: string;
  component: string;
  stories: readonly { name: string; element: readonly unknown[] }[];
}

export interface CatalogEntry {
  title: string | null;
  stories: string | null;
  apg: string | null;
}

/** Read a story file (`(<kind>-stories: stories (component KIND) ...)`). */
export function parseStories(text: string): StorySet;
/** Read the control catalog: the entries by kind name, in file order. */
export function parseCatalog(text: string): Map<string, CatalogEntry>;
/** The document ID of a story: `<component>-<story>`. */
export function storyId(component: string, name: string): string;
/** Every story of the sets as one document. */
export function storiesDocument(
  sets: readonly StorySet[],
  options?: { id?: string }
): string;
