/**
 * Type declarations of `@link-foundation/ui-settings` (see README.md).
 */

import type { Config, EditableLayer } from '@link-foundation/ui-config';

/** A diagnostic, in the shape ui-core uses. */
export interface Diagnostic {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  at?: Record<string, unknown>;
}

/** Where a value is applied on `<html>`. */
export interface ApplyTarget {
  /** `--liquid-blur`: set as a CSS custom property. */
  cssVar?: string;
  /** `theme-mode`: set as the attribute `data-theme-mode`. */
  dataAttr?: string;
}

export interface NormalizationPolicy {
  primitives?: 'coerce' | 'strict';
  numbers?: 'snap' | 'clamp';
}

export interface SettingField {
  random?: { min?: number; max?: number } | 'not-heavier-than-default';
  normalization?: NormalizationPolicy;
  key: string;
  type: string;
  default: unknown;
  label?: string;
  description?: string;
  section?: string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: string[];
  /** A comfort field: kept from the viewer, never randomised. */
  comfort: boolean;
  apply: ApplyTarget[];
  /** Other clauses, for custom field types. */
  props: Record<string, unknown>;
}

export interface SettingsSection {
  'visible-when'?: unknown;
  presets?: string[];
  levels?: string[];
  preview?: unknown;
  extraHeight?: number;
  tabs?: string[];
  level?: string;
  id: string;
  label?: string;
  description?: string;
}

export interface SettingsPreset {
  partial?: boolean;
  id: string;
  label?: string;
  description?: string;
  values: Record<string, unknown>;
}

export interface SettingsMigration {
  from: number;
  to: number;
  renames: Array<{ from: string; to: string }>;
  oldDefaults: Array<{ key: string; raw: unknown }>;
}

export interface SettingsSchema {
  version: number;
  fields: Map<string, SettingField>;
  sections: SettingsSection[];
  presets: Map<string, SettingsPreset>;
  migrations: SettingsMigration[];
}

/** A value for every field: `{ 'liquid.blur': 24, … }`. */
export type SettingsValues = Record<string, unknown>;

export interface ReadOptions {
  normalization?: NormalizationPolicy;
  /** The largest input read, in characters. */
  maxInputSize?: number;
}

export function readSchema(
  text: string,
  options?: ReadOptions
): { schema: SettingsSchema; diagnostics: Diagnostic[] };
export function fieldsOf(schema: SettingsSchema): SettingField[];

export interface CoerceResult {
  ok: boolean;
  value?: unknown;
}

export interface FieldType {
  coerce(field: SettingField, raw: unknown): CoerceResult;
  equals(a: unknown, b: unknown): boolean;
  random(field: SettingField, random: () => number): unknown;
  format(field: SettingField, value: unknown): string | string[];
  css(field: SettingField, value: unknown): string;
}

export const BUILT_IN_TYPES: readonly string[];
export function defineFieldType(
  name: string,
  definition: Partial<FieldType> & Pick<FieldType, 'coerce'>
): Readonly<FieldType>;
export function fieldType(name: string): Readonly<FieldType> | undefined;
export function fieldTypes(): string[];

export function coerce(
  field: SettingField,
  raw: unknown,
  policy?: NormalizationPolicy
): CoerceResult;
export function equalValue(
  field: SettingField,
  a: unknown,
  b: unknown
): boolean;
export function formatValue(field: SettingField, value: unknown): string[];
export function cssValue(field: SettingField, value: unknown): string;

export function defaults(schema: SettingsSchema): SettingsValues;
export function merge(
  schema: SettingsSchema,
  base: SettingsValues | undefined,
  untrusted: unknown
): { values: SettingsValues; rejected: string[] };
export function diff(
  schema: SettingsSchema,
  values: SettingsValues
): SettingsValues;
export function isDefault(
  schema: SettingsSchema,
  key: string,
  value: unknown
): boolean;
export function reset(
  schema: SettingsSchema,
  values: SettingsValues,
  keys?: Iterable<string>
): SettingsValues;
export function countCustomized(
  schema: SettingsSchema,
  values: SettingsValues
): number;
export function equalValues(
  schema: SettingsSchema,
  a: SettingsValues,
  b: SettingsValues,
  options?: { skip?: (field: SettingField) => boolean }
): boolean;

export function applyPreset(
  schema: SettingsSchema,
  values: SettingsValues,
  id: string
): SettingsValues;
export function activePreset(
  schema: SettingsSchema,
  values: SettingsValues
): string | null;
export function applySharedLook(
  schema: SettingsSchema,
  viewer: SettingsValues | undefined,
  look: SettingsValues
): SettingsValues;

export function randomize(
  schema: SettingsSchema,
  values: SettingsValues | undefined,
  options: { random: () => number; locked?: Iterable<string> }
): SettingsValues;

export interface MigrateOptions {
  /** The values the result is merged onto (default: the defaults). */
  base?: SettingsValues;
  /** The values are a shared look: missing keys take the old defaults. */
  look?: boolean;
}

export function migrate(
  schema: SettingsSchema,
  stored: { version?: number; values?: unknown },
  options?: MigrateOptions
): {
  values: SettingsValues;
  rejected: string[];
  version: number;
  diagnostics: Diagnostic[];
};

export interface ReadResult {
  ok: boolean;
  values: SettingsValues;
  rejected: string[];
  version: number;
  diagnostics: Diagnostic[];
}

export const MAX_SHARE_HASH: number;
export const SHARE_PARAM: 'settings';
export const LEGACY_SHARE_PARAM: 'ui';
export function toLino(
  schema: SettingsSchema,
  values: SettingsValues,
  options?: { style?: 'indented' | 'inline' }
): string;
export function fromLino(
  schema: SettingsSchema,
  text: string,
  options?: MigrateOptions & ReadOptions
): ReadResult;
export function fromLegacyJson(
  schema: SettingsSchema,
  json: string | object,
  options?: MigrateOptions & { version?: number }
): ReadResult;
export function toShareHash(
  schema: SettingsSchema,
  values: SettingsValues
): string;
export function fromShareHash(
  schema: SettingsSchema,
  hash: string,
  viewerValues?: SettingsValues
): ReadResult & {
  format: 'lino' | 'konard-json' | 'immortality-json' | null;
};

export const PAINT_STORAGE_KEY: string;
export function attributeName(name: string): string;
export function applyToRoot(
  schema: SettingsSchema,
  values: SettingsValues,
  root?: HTMLElement,
  options?: { project?: SettingsProjection; channels?: boolean }
): void;
export function paintSnapshot(
  schema: SettingsSchema,
  values: SettingsValues,
  options?: { includeAll?: boolean }
): string;
export function beforePaintScript(
  schema: SettingsSchema,
  options?: BeforePaintOptions
): string;
export function beforePaintScriptHash(
  schemaOrScript: SettingsSchema | string,
  options?: BeforePaintOptions
): Promise<string>;

export function assertEverySettingUsed(
  schema: SettingsSchema,
  files?: { css?: string | string[]; sources?: string | string[] }
): void;

export interface BoundSettings {
  values(): SettingsValues;
  get(key: string): unknown;
  set(key: string, value: unknown): { rejected: string[] };
  update(changes: Record<string, unknown>): { rejected: string[] };
  reset(keys?: Iterable<string>): void;
  subscribe(listener: (values: SettingsValues) => void): () => void;
}

export function bindConfig(
  config: Config,
  schema: SettingsSchema,
  options?: { target?: string; layer?: EditableLayer }
): BoundSettings;

export type SettingsProjection = (values: SettingsValues) => {
  css?: Record<string, string | number | null>;
  attributes?: Record<string, string | number | null>;
};
export interface BeforePaintOptions {
  storageKey?: string;
  /** Serialized into the script: use a standalone function or preloaded globals. */
  readStorage?: (text: string | null) => unknown;
  project?: SettingsProjection;
}
export function createSettingsCodec(
  schema: SettingsSchema,
  codec: {
    decode(text: string): unknown;
    encode(values: SettingsValues): string;
  }
): {
  read(
    text: string,
    options?: { base?: SettingsValues; look?: boolean }
  ): {
    ok: boolean;
    values: SettingsValues;
    rejected: string[];
  };
  write(values: SettingsValues): string;
};

export function hexToChannels(hex: string): string;

export function looksToLino(
  schema: SettingsSchema,
  looks: Record<string, SettingsValues>
): string;
export function looksFromLino(
  schema: SettingsSchema,
  text: string
): { ok: boolean; looks: Record<string, SettingsValues> } | null;
