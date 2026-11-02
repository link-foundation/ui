/**
 * Type declarations of `@link-foundation/ui-config` (see README.md).
 */

import type {
  Diagnostic,
  FormatOptions,
  RawValue,
  UiDocument,
} from '@link-foundation/ui-core';
import type { Store } from '@link-foundation/ui-store';

/** The configuration layers, lowest first. */
export type Layer = 'defaults' | 'theme' | 'site' | 'user' | 'session';
/** The layers `set`, `unset` and `importPatch` may change. */
export type EditableLayer = 'user' | 'session';

export const LAYERS: readonly Layer[];
export const EDITABLE_LAYERS: readonly EditableLayer[];
/** Props whose first value is a key: `token`, `state`. */
export const DEFAULT_KEYED_PROPS: readonly string[];
/** The layer the values of the base document count as: `site`. */
export const DOCUMENT_LAYER: 'site';
export const KEY_SEPARATOR: string;
/** The map key of one override: id, name and key joined by `KEY_SEPARATOR`. */
export function overrideKey(
  id: string,
  name: string,
  key?: string | null
): string;

/** How a property name is read for an element. */
export type TargetMode = 'positional' | 'keyed' | 'prop';

export interface Override {
  id: string;
  name: string;
  /** The key of a keyed prop, else `null`. */
  key: string | null;
  mode: TargetMode;
  values: readonly RawValue[];
}

/** A value and the layer it comes from. */
export interface LayerValue {
  layer: Layer;
  value: readonly RawValue[];
}

/** One change of one layer; `null` means "no override". */
export interface ConfigEvent {
  layer: Layer;
  id: string;
  name: string;
  key: string | null;
  mode: TargetMode;
  before: readonly RawValue[] | null;
  after: readonly RawValue[] | null;
}

/** All the changes of one call, in order. */
export type ConfigListener = (events: readonly ConfigEvent[]) => void;

export interface PatchResult {
  ok: boolean;
  diagnostics: Diagnostic[];
}

export interface ExportOptions {
  /** The layers to export; default `['user', 'session']`. */
  layers?: readonly Layer[];
  /** Export only values that differ from this layer and those below; default `site`. */
  against?: Layer;
  /** The `(layer …)` of the patch; default the lowest exported layer. */
  layer?: Layer;
  /** The patch name; default `<layer>-overrides`. */
  name?: string;
  /** The `(base …)` of the patch; default `config.base`. */
  base?: string | null;
}

export interface BindStoreOptions {
  /** The origin of the store transactions; default `config`. */
  origin?: string;
  /** The label of the store transactions; default `Apply configuration`. */
  label?: string | null;
}

export interface ConfigOptions {
  /** The base document (`site` values), as ui-core `parse` returns it. */
  document: Pick<UiDocument, 'roots'> & Partial<UiDocument>;
  /** Patches to load into layers when the config is created. */
  layers?: Partial<Record<Layer, string>>;
  /** Default `DEFAULT_KEYED_PROPS`. */
  keyedProps?: readonly string[];
  /** The id patches are written for; default the id of the first root. */
  base?: string | null;
  /** In UTF-8 bytes; default `DEFAULT_MAX_PATCH_SIZE` (64 KiB). */
  maxPatchSize?: number;
  /** Default `DEFAULT_MAX_PATCH_OPS` (2,000). */
  maxPatchOps?: number;
  /** Called when a listener throws; default `console.error`. */
  onListenerError?: (error: unknown, events: readonly ConfigEvent[]) => void;
}

export interface Config {
  readonly base: string | null;
  readonly layers: readonly Layer[];
  readonly keyedProps: readonly string[];
  /** The winning value and its layer, or `undefined`. */
  resolve(id: string, name: string, key?: string): LayerValue | undefined;
  /** Every layer that has a value, lowest first. */
  explain(id: string, name: string, key?: string): LayerValue[];
  /** The value of one layer only. */
  valueIn(
    layer: Layer,
    id: string,
    name: string,
    key?: string
  ): readonly RawValue[] | undefined;
  /** Throws a `ConfigError` for a layer other than user or session. */
  set(
    layer: EditableLayer,
    id: string,
    name: string,
    values: RawValue[],
    key?: string
  ): void;
  unset(layer: EditableLayer, id: string, name: string, key?: string): void;
  /** Remove every override of a layer (any layer). */
  clear(layer: Layer): void;
  /** Replace a layer (any layer) with a patch; with an error nothing changes. */
  loadLayer(layer: Layer, text: string): PatchResult;
  /** Apply a patch on top of user or session; with an error nothing changes. */
  importPatch(text: string, layer?: EditableLayer): PatchResult;
  /** The overrides of a layer, in the order they were written. */
  overrides(layer: Layer): Override[];
  /** A copy of the base document with every resolved value applied. */
  effective(): UiDocument;
  /** The overrides of `layers` that differ from `against`, as a patch. */
  exportPatch(options?: ExportOptions): string;
  subscribe(listener: ConfigListener): () => boolean;
  bindStore(store: Store, options?: BindStoreOptions): () => void;
}

export function createConfig(options: ConfigOptions): Config;

export type PatchOp =
  | {
      op: 'set';
      id: string;
      name: string;
      key: string | null;
      values: RawValue[];
    }
  | { op: 'unset'; id: string; name: string; key: string | null };

export interface Patch {
  name: string | null;
  layer: Layer | null;
  base: string | null;
  ops: PatchOp[];
}

export interface ReadPatchOptions {
  keyedProps?: readonly string[];
  maxSize?: number;
  maxOps?: number;
}

export const DEFAULT_MAX_PATCH_SIZE: number;
export const DEFAULT_MAX_PATCH_OPS: number;
export const PATCH_KIND: 'overrides';

/** Never throws; a patch over the limits has no ops. */
export function readPatch(
  text: string,
  options?: ReadPatchOptions
): Patch & { diagnostics: Diagnostic[] };
export function writePatch(
  patch: Partial<Patch> & Pick<Patch, 'ops'>,
  options?: FormatOptions
): string;

/** One line per changed value of `layers` (default user and session). */
export function describeChanges(
  config: Config,
  layers?: readonly Layer[]
): string[];

export const STORAGE_KEYS: Readonly<Record<EditableLayer, string>>;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface PersistOptions {
  onDiagnostic?: (diagnostic: Diagnostic) => void;
}

export interface Persistence {
  diagnostics: Diagnostic[];
  stop(): void;
}

export function persistLayer(
  config: Config,
  layer: EditableLayer,
  storage: StorageLike | null | undefined,
  key?: string,
  options?: PersistOptions
): Persistence;
export function persistUserLayer(
  config: Config,
  storage?: StorageLike | null,
  key?: string,
  options?: PersistOptions
): Persistence;
export function persistSessionLayer(
  config: Config,
  storage?: StorageLike | null,
  key?: string,
  options?: PersistOptions
): Persistence;

export const CONFIG_ORIGIN: 'config';
export function bindStore(
  config: Config,
  store: Store,
  options?: BindStoreOptions
): () => void;

export type ConfigErrorCode =
  | 'unknown-layer'
  | 'read-only-layer'
  | 'unknown-id'
  | 'missing-key'
  | 'bad-value'
  | 'bad-document'
  | 'bad-patch';

export class ConfigError extends Error {
  constructor(code: ConfigErrorCode, message: string);
  code: ConfigErrorCode;
  /** Set for `bad-patch`. */
  diagnostics?: Diagnostic[];
}
