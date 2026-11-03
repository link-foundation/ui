/**
 * The import vocabulary: the ui-dialect/0 vocabulary (#11) plus what an
 * imported HTML document needs to be a valid dialect document.
 *
 * - kind `html`: the lossless fallback for every element without a dialect
 *   kind; it keeps the tag and every attribute;
 * - kind `comment`: HTML comments, kept only with `options.comments`;
 * - on `text`, `button` and `image`: `tag` (the HTML tag when it is not the
 *   kind's own), `attr` (every other attribute), an inline `style` (the
 *   declarations themselves, not a reference to a style element) and
 *   `raw-css` (the text of `<style>` children); `level` on `text` for
 *   headings.
 *
 * The extension is Links Notation in the shape of docs/spec/vocabulary.lino
 * and is read by `loadVocabulary` from `@link-foundation/ui-core`.
 */

import { defaultVocabulary, loadVocabulary } from '@link-foundation/ui-core';

export const HTML_VOCABULARY_TEXT = `html: kind
  description 'An HTML element without a dialect kind; keeps its tag and every attribute.'
  property tag string
  property attr any multi
  property style any
  property raw-css string multi
  children any

comment: kind
  description 'An HTML comment.'
  positional value
  property value string
  children none

text: kind
  property tag string
  property level number
  property attr any multi
  property style any
  property raw-css string multi

button: kind
  property tag string
  property attr any multi
  property style any
  property raw-css string multi

image: kind
  property tag string
  property attr any multi
  property style any
  property raw-css string multi
`;

/**
 * Merge a vocabulary extension into a copy of `base`: new kinds are added,
 * and the properties of a kind that `base` already has are added to (or
 * replace) its properties; its positional values and children rule stay.
 * @param {import('@link-foundation/ui-core').Vocabulary} base
 * @param {string} text
 */
export function extendVocabulary(base, text) {
  const extension = loadVocabulary(text);
  const kinds = new Map(base.kinds);
  for (const [name, spec] of extension.kinds) {
    const known = kinds.get(name);
    kinds.set(
      name,
      known
        ? {
            ...known,
            properties: new Map([...known.properties, ...spec.properties]),
          }
        : spec
    );
  }
  return { ...base, kinds };
}

let cached = null;

/**
 * The vocabulary of imported documents: ui-dialect/0 plus
 * {@link HTML_VOCABULARY_TEXT}. Pass it to `parse` from
 * `@link-foundation/ui-core` to read an import result without diagnostics.
 */
export function htmlVocabulary() {
  cached ??= extendVocabulary(defaultVocabulary(), HTML_VOCABULARY_TEXT);
  return cached;
}
