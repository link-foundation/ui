/**
 * The ui-dialect/0 vocabulary with the props of this package, for ui-core
 * `parse(text, { vocabulary: i18nVocabulary() })`:
 *
 * - `document` gets `(locale TAG)`, `(dir ltr|rtl)` and
 *   `(i18n required|optional)`, so they are props (and `locale` is a `site`
 *   value of ui-config), not unknown sublinks;
 * - every kind gets `(t KEY ...)`, the message that stands for its first
 *   positional value: `(greeting: text (t greeting (name 'Ada')))`.
 *
 * With the default vocabulary the same links are kept in `unknown` (with an
 * `unknown-sublink` warning); everything in this package reads both forms.
 */

import { defaultVocabulary } from '@link-foundation/ui-core';
import { MESSAGE_HEAD } from './message.js';

/** Props added to the `document` kind. */
export const ROOT_PROPS = Object.freeze({
  locale: { type: 'string', multi: false },
  dir: { type: ['enum', 'ltr', 'rtl'], multi: false },
  i18n: { type: ['enum', 'required', 'optional'], multi: false },
});

/**
 * A copy of `base` with the i18n props. `base` is not changed.
 * @param {import('@link-foundation/ui-core').Vocabulary} [base]
 */
export function i18nVocabulary(base = defaultVocabulary()) {
  const kinds = new Map();
  for (const [name, kind] of base.kinds) {
    const properties = new Map(kind.properties);
    if (!properties.has(MESSAGE_HEAD)) {
      properties.set(MESSAGE_HEAD, { type: 'any', multi: false });
    }
    if (name === 'document') {
      for (const [prop, spec] of Object.entries(ROOT_PROPS)) {
        if (!properties.has(prop)) {
          properties.set(prop, { ...spec });
        }
      }
    }
    kinds.set(name, { ...kind, properties });
  }
  return {
    ...base,
    kinds,
    actions: new Map(base.actions),
    multiValued: new Set(base.multiValued),
  };
}
