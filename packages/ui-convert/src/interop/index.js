/**
 * Interop with other UI formats: A2UI, Adaptive Cards, JSON Forms and
 * Lottie. Every format has an importer (JSON -> LiNo, with the element
 * tree and diagnostics) and an exporter (LiNo -> JSON, with diagnostics);
 * unknown properties survive a round trip in `(extra <format> '<json>')`.
 */

import { exportA2ui, importA2ui } from './a2ui/index.js';
import { MESSAGE_TYPES } from './a2ui/shared.js';
import {
  exportAdaptiveCard,
  importAdaptiveCard,
} from './adaptive-cards/index.js';
import { exportJsonForms, importJsonForms } from './json-forms/index.js';
import { exportLottie, importLottie } from './lottie/index.js';
import { isObject } from './safety.js';

export * from './a2ui/index.js';
export * from './adaptive-cards/index.js';
export * from './json-forms/index.js';
export * from './lottie/index.js';
export { decodeAny, encodeAny, extraProperty, readExtra } from './extra.js';
export { interopVocabulary } from './vocabulary.js';

/**
 * @typedef {'a2ui'|'adaptive-cards'|'json-forms'|'lottie'} Format
 */

/** The format names, in the order `detectFormat` checks them. */
export const FORMATS = ['adaptive-cards', 'lottie', 'json-forms', 'a2ui'];

/** Whether a value is one A2UI message: exactly one message type key. */
const isA2uiMessage = (value) =>
  isObject(value) && MESSAGE_TYPES.filter((type) => type in value).length === 1;

const isA2uiStream = (list) =>
  Array.isArray(list) && list.length > 0 && list.every(isA2uiMessage);

/** The JSON Forms UI schema element types. */
const UI_SCHEMA_TYPES = [
  'Control',
  'VerticalLayout',
  'HorizontalLayout',
  'Group',
  'Categorization',
  'Category',
  'Label',
];

const DETECTORS = {
  'adaptive-cards': (json) => isObject(json) && json.type === 'AdaptiveCard',
  lottie: (json) =>
    isObject(json) && Array.isArray(json.layers) && typeof json.fr === 'number',
  'json-forms': (json) =>
    isObject(json) &&
    isObject(json.uischema) &&
    UI_SCHEMA_TYPES.includes(json.uischema.type),
  a2ui: (json) =>
    isA2uiMessage(json) ||
    isA2uiStream(json) ||
    (isObject(json) && isA2uiStream(json.messages)),
};

/**
 * The format of a parsed JSON value:
 *
 * - `adaptive-cards`: an object with `type: "AdaptiveCard"`;
 * - `lottie`: an object with a `layers` array and a numeric frame rate `fr`;
 * - `json-forms`: `{ schema?, uischema }` with a UI schema element;
 * - `a2ui`: one A2UI message, a non-empty array of them or
 *   `{ messages: [...] }`.
 *
 * @param {unknown} json
 * @returns {Format|null} `null` when the value is none of these.
 */
export function detectFormat(json) {
  return FORMATS.find((format) => DETECTORS[format](json)) ?? null;
}

/**
 * The importer and exporter of every format, with one signature:
 * `import(json, { style })` and `export(doc, { id, targetVersion })`.
 * @type {Record<Format, { import: Function, export: Function }>}
 */
export const CONVERTERS = {
  a2ui: { import: importA2ui, export: exportA2ui },
  'adaptive-cards': { import: importAdaptiveCard, export: exportAdaptiveCard },
  'json-forms': { import: importJsonForms, export: exportJsonForms },
  lottie: {
    import: importLottie,
    export: (doc, options = {}) => exportLottie(doc, options.id),
  },
};
