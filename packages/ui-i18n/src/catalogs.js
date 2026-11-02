/**
 * Catalogs: Links Notation translation files read with lino-i18n. A catalog
 * file may hold several locales (`en`, `ru`, ... as top-level blocks); the
 * result is always `Record<locale, Record<key, string>>`, ready for
 * `createLocalizer({ catalogs })`.
 */

import { parseLinoCatalogs } from 'lino-i18n/browser';

/**
 * @typedef {Record<string, Record<string, string>>} Catalogs
 */

/**
 * Merge catalogs; later ones win for the same locale and key.
 * @param {...Catalogs} catalogs
 * @returns {Catalogs}
 */
export function mergeCatalogs(...catalogs) {
  /** @type {Catalogs} */
  const merged = {};
  for (const catalog of catalogs) {
    for (const [locale, translations] of Object.entries(catalog ?? {})) {
      merged[locale] = { ...(merged[locale] ?? {}), ...translations };
    }
  }
  return merged;
}

/**
 * Read the locales of one catalog text (wraps lino-i18n `parseLinoCatalogs`).
 * Blocks without a locale are ignored; repeated locales are merged.
 * @param {string} text
 * @returns {Catalogs}
 */
export function readCatalogs(text) {
  return mergeCatalogs(
    ...parseLinoCatalogs(text)
      .filter(({ locale }) => typeof locale === 'string' && locale !== '')
      .map(({ locale, translations }) => ({ [locale]: translations }))
  );
}

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
