/** Browser runtime; filesystem catalog loaders remain on the default Node entry. */
export {
  MESSAGE_HEAD,
  isMessage,
  isMessageLink,
  message,
  messageRaw,
  parseMessage,
  typeValue,
} from './message.js';
export { readCatalogs, mergeCatalogs } from './catalog-text.js';
export { UI_CATALOG_URL, loadUiCatalogs } from './catalogs.browser.js';
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

export { iconPart, messageParts } from './parts.js';
