import { defaultVocabulary, loadVocabulary } from '@link-foundation/ui-core';

/** Extend the UI dialect explicitly, without mutating the shared vocabulary. */
export function networkVocabulary() {
  const base = defaultVocabulary();
  const extension = loadVocabulary(`links-network: kind
  property on action multi
  property label string
  property layout
    enum circle grid hex spiral force layered
  property style
    enum glyph node-edge
  property labels any
  property items any
  children none
`);
  return { ...base, kinds: new Map([...base.kinds, ...extension.kinds]) };
}
