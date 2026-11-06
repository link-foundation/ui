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
