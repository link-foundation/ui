/* global URL */
import { readCatalogs } from './catalog-text.js';

/** Framework translations, tracked as an asset by browser bundlers. */
export const UI_CATALOG_URL = new URL('../locales/ui.lino', import.meta.url);

/** Load the shipped catalogs using fetch, including inlined data URLs. */
export async function loadUiCatalogs(options = {}) {
  const response = await (options.fetch ?? globalThis.fetch)(UI_CATALOG_URL);
  if (!response.ok) {
    throw new Error(`Cannot load ${UI_CATALOG_URL}: HTTP ${response.status}`);
  }
  return readCatalogs(await response.text());
}
