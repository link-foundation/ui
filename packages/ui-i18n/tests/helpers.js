/**
 * Shared helpers of the ui-i18n tests: the framework catalogs and a
 * catalog with interpolation and plurals.
 */

import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { parse } from '@link-foundation/ui-core';
import { createConfig } from '@link-foundation/ui-config';
import {
  createLocalizer,
  i18nVocabulary,
  mergeCatalogs,
  readCatalogs,
} from '@link-foundation/ui-i18n';

/** The text of `locales/ui.lino`. */
export const uiCatalogText = () =>
  readFileSync(new URL('../locales/ui.lino', import.meta.url), 'utf8');

/** A fixture of tests/fixtures. */
export const fixture = (name) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

/** The framework catalogs plus tests/fixtures/app.lino. */
export const catalogs = () =>
  mergeCatalogs(
    readCatalogs(uiCatalogText()),
    readCatalogs(fixture('app.lino'))
  );

/** The sample app document, read with the i18n vocabulary. */
export const appDocument = () =>
  parse(fixture('document.lino'), { vocabulary: i18nVocabulary() });

/**
 * A config of the sample document and a localizer with no platform
 * languages (deterministic: no navigator).
 */
export function setup(options = {}) {
  const config = createConfig({ document: appDocument() });
  const missing = [];
  const localizer = createLocalizer({
    config,
    catalogs: catalogs(),
    languages: [],
    onMissing: (key, locale) => missing.push([key, locale]),
    ...options,
  });
  return { config, localizer, missing };
}
