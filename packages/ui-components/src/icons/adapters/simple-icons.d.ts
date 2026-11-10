import type { AssetRecord } from '../index.js';
import type { AdapterOptions, AdapterSource, IconAdapter } from './shared.js';
export type { AdapterOptions, AdapterSource, IconAdapter } from './shared.js';
export const SIMPLE_ICONS_TRADEMARK_NOTICE: string;
export function simpleIconsRecord(name: string): AssetRecord;
export const SIMPLE_ICONS: Readonly<IconAdapter>;
export function createSimpleIconsSource(
  options?: AdapterOptions
): AdapterSource;
