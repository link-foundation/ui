import type { AssetRecord, IconSource } from '../index.js';

export interface IconAdapter {
  set: string;
  packageName: string;
  title: string;
  /** Logical name → name in the library. */
  names: Readonly<Record<string, string>>;
  loadSvg(name: string): Promise<string>;
  record(name: string): AssetRecord;
  licenseFiles: string[];
  notices?: Record<string, string>;
  defaults?: Record<string, string>;
}

export interface AdapterOptions {
  /** Replace the loader, for example to read your own copy of the package. */
  load?: (name: string) => Promise<string>;
  /** Extra or replaced logical names. */
  names?: Record<string, string>;
}

export type AdapterSource = Readonly<
  IconSource & { set: string; adapter: IconAdapter; names(): string[] }
>;

export function isIconName(name: unknown): boolean;
export function readPackageFile(specifier: string): Promise<string>;
export function createAdapterSource(
  adapter: IconAdapter,
  options?: AdapterOptions
): AdapterSource;
