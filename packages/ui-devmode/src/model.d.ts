/**
 * Type declarations of `@link-foundation/ui-devmode/model`: the pure model
 * of the inspector (outline, property rows, edits).
 */

// Resolve declarations through package exports in TypeScript and Deno alike.
import type { DevModePolicy, WritableLayer } from '@link-foundation/ui-devmode';

export const READ_ONLY_LAYERS: readonly ['defaults', 'theme', 'site'];

export class DevModeError extends Error {
  /** `read-only-layer`, `locked-element`, `bad-value`, `not-editable` or
   * `unknown-element`. */
  code: string;
  constructor(code: string, message: string);
}

export interface OutlineNode {
  id: string;
  type: string;
  children: OutlineNode[];
}

export function buildOutline(tree: object): OutlineNode[];
export function flattenOutline(
  outline: readonly OutlineNode[]
): { node: OutlineNode; level: number; parent: string | null }[];
export function isLocked(
  policy: DevModePolicy,
  id: string,
  parentOf?: (id: string) => string | null
): boolean;
export function topWritableLayer(policy: DevModePolicy): WritableLayer | null;
export function editorFor(
  type: string | readonly string[] | undefined,
  values: readonly unknown[] | undefined
): { editor: string; options?: readonly string[]; units?: readonly string[] };
export function formatValues(values: readonly unknown[] | undefined): string;

export interface PropertyRow {
  name: string;
  key: string | null;
  label: string;
  type: string | readonly string[] | undefined;
  editor: string;
  options?: readonly string[];
  units?: readonly string[];
  value: readonly unknown[] | undefined;
  text: string;
  layer: string;
  changed: boolean;
  locked: boolean;
  writable: boolean;
}

export function propertyRows(
  element: { id: string; kind: string; positional?: readonly unknown[] },
  config: object,
  options?: object
): PropertyRow[];
export function editValues(value: unknown): readonly unknown[];

export interface EditOptions {
  policy: DevModePolicy;
  vocabulary?: object;
  parentOf?: (id: string) => string | null;
  document?: object;
  getElement?: (id: string) => object | undefined;
}

/** Write one property to a writable layer (the top one by default). */
export function applyEdit(
  config: object,
  edit: {
    id: string;
    name: string;
    value: unknown;
    key?: string | null;
    layer?: string;
  },
  options: EditOptions
): {
  id: string;
  name: string;
  key: string | null;
  layer: WritableLayer;
  values: readonly unknown[];
};
export function resetProperty(
  config: object,
  target: { id: string; name: string; key?: string | null },
  options: {
    policy: DevModePolicy;
    parentOf?: (id: string) => string | null;
  }
): WritableLayer | null;
export function saveSession(
  config: object,
  options: { policy: DevModePolicy }
): number;
export function discardSession(config: object): number;
