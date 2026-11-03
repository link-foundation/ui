import { defaultVocabulary, loadVocabulary } from '@link-foundation/ui-core';

/** Additional data kinds; all values are parsed by the official LiNo reader. */
export const DATA_VOCABULARY_TEXT = `list: kind
  property on action multi
  property label string
  property items any
  property template string
  property selection
    enum single multi none
  property virtualized boolean
  property item-height number
  property loading boolean
  property error string
  property empty string
  children none

tree: kind
  property on action multi
  property label string
  property items any
  property template string
  property selection
    enum single multi none
  property virtualized boolean
  property item-height number
  property loading boolean
  property error string
  property empty string
  children none

table: kind
  property on action multi
  property label string
  property caption string
  property items any
  property columns any
  property selection
    enum single multi none
  property virtualized boolean
  property item-height number
  property loading boolean
  property error string
  property empty string
  children none
`;

let cached;
export function dataVocabulary() {
  if (!cached) {
    const base = defaultVocabulary();
    const data = loadVocabulary(DATA_VOCABULARY_TEXT).kinds;
    for (const kind of data.values()) {
      kind.properties.set(
        'note',
        base.kinds.get('document').properties.get('note')
      );
    }
    cached = {
      ...base,
      kinds: new Map([...base.kinds, ...data]),
    };
  }
  return cached;
}
