import type { AssetRecord } from '../index.js';
import type { AdapterOptions, AdapterSource, IconAdapter } from './shared.js';

export type { AdapterOptions, AdapterSource, IconAdapter } from './shared.js';
export const MATERIAL_SYMBOLS_NAMES: Readonly<Record<string, string>>;
/** The NOTICE shipped with the icons (Apache-2.0 section 4). */
export const MATERIAL_SYMBOLS_NOTICE: string;
export function materialSymbolsRecord(name: string): AssetRecord;
export function loadMaterialSymbolsSvg(name: string): Promise<string>;
export const MATERIAL_SYMBOLS: Readonly<IconAdapter>;
export function createMaterialSymbolsSource(
  options?: AdapterOptions
): AdapterSource;
