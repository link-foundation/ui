/** @typedef {import('./catalog-text.js').Catalogs} Catalogs */
import { readCatalogs } from './catalog-text.js';
export { readCatalogs, mergeCatalogs } from './catalog-text.js';

/**
 * Load every `.lino` file of a directory (Node.js, Bun and Deno; wraps
 * lino-i18n `loadLocalesFromDirectory`).
 * @param {string} dir
 * @param {{ recursive?: boolean }} [options]
 * @returns {Promise<Catalogs>}
 */
export async function loadCatalogDir(dir, options = {}) {
  const { loadLocalesFromDirectory } = await import('lino-i18n/loaders');
  return loadLocalesFromDirectory(dir, options);
}

/** The framework catalog `locales/ui.lino` (en, ru, zh, hi). */
export const UI_CATALOG_URL = new globalThis.URL(
  '../locales/ui.lino',
  import.meta.url
);

/** The directory of the framework catalogs. */
export const UI_LOCALES_URL = new globalThis.URL(
  '../locales/',
  import.meta.url
);

/**
 * Load the framework catalogs: from the file system for `file:` URLs, with
 * `fetch` otherwise (browsers, bundlers that copy the file).
 * @param {{ fetch?: typeof fetch }} [options]
 * @returns {Promise<Catalogs>}
 */
export async function loadUiCatalogs(options = {}) {
  if (UI_CATALOG_URL.protocol === 'file:') {
    const { readFile } = await import('node:fs/promises');
    return readCatalogs(await readFile(UI_CATALOG_URL, 'utf8'));
  }
  const fetchCatalog = options.fetch ?? globalThis.fetch;
  const response = await fetchCatalog(UI_CATALOG_URL);
  if (!response.ok) {
    throw new Error(`Cannot load ${UI_CATALOG_URL}: HTTP ${response.status}`);
  }
  return readCatalogs(await response.text());
}
