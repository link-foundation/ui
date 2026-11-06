/**
 * `@link-foundation/ui-i18n`: localisation of the associative UI framework
 * with lino-i18n. Documents refer to messages with `(t KEY (PARAM VALUE) ...)`;
 * the locale is the root prop `locale` resolved through the ui-config layers.
 * Browser bundlers select browser.js; this default entry also exposes the
 * filesystem catalog loaders for Node.js.
 */

export {
  MESSAGE_HEAD,
  isMessage,
  isMessageLink,
  message,
  messageRaw,
  parseMessage,
  typeValue,
} from './message.js';
export {
  UI_CATALOG_URL,
  UI_LOCALES_URL,
  loadCatalogDir,
  loadUiCatalogs,
  mergeCatalogs,
  readCatalogs,
} from './catalogs.js';
export {
  LOCALE_PROP,
  createLocalizer,
  localeDirection,
  resolveText,
} from './localizer.js';
export { localizeDocument } from './document.js';
export { ROOT_PROPS, i18nVocabulary } from './vocabulary.js';
export {
  DEFAULT_TEXT_KINDS,
  DEFAULT_TEXT_PROPS,
  HARDCODED_TEXT,
  checkHardcodedText,
  requiresI18n,
} from './lint.js';
export { propAtom, propValues } from './props.js';
