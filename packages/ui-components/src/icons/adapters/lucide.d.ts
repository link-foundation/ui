import type { AssetRecord } from '../index.js';
import type { AdapterOptions, AdapterSource, IconAdapter } from './shared.js';

export type { AdapterOptions, AdapterSource, IconAdapter } from './shared.js';
export const LUCIDE_NAMES: Readonly<Record<string, string>>;
/** Lucide icons derived from Feather (also MIT). */
export const FEATHER_DERIVED: ReadonlySet<string>;
export const LUCIDE_ATTRIBUTES: Readonly<Record<string, string | number>>;
export function lucideRecord(
  name: string,
  options?: { featherDerived?: boolean }
): AssetRecord;
export function loadLucideSvg(name: string): Promise<string>;
export const LUCIDE: Readonly<IconAdapter>;
export function createLucideSource(options?: AdapterOptions): AdapterSource;
