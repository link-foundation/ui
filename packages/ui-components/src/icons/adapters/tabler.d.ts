import type { AssetRecord } from '../index.js';
import type { AdapterOptions, AdapterSource, IconAdapter } from './shared.js';

export type { AdapterOptions, AdapterSource, IconAdapter } from './shared.js';
export const TABLER_NAMES: Readonly<Record<string, string>>;
export function tablerRecord(name: string): AssetRecord;
export function loadTablerSvg(name: string): Promise<string>;
export const TABLER: Readonly<IconAdapter>;
export function createTablerSource(options?: AdapterOptions): AdapterSource;
