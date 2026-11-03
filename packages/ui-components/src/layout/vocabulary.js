/**
 * The vocabulary of the layout elements, in the shape of
 * docs/spec/vocabulary.lino, and the ui-core vocabulary extended with it.
 * Parse layout documents with `{ vocabulary: layoutVocabulary() }`: then
 * their properties are checked, and none is reported as unknown.
 */

import { defaultVocabulary, loadVocabulary } from '@link-foundation/ui-core';

/** The layout kinds as Links Notation. */
export const LAYOUT_VOCABULARY_TEXT = `stack: kind
  description 'Lays its children out in one direction (CSS flexbox).'
  property direction
    enum vertical horizontal row column row-reverse column-reverse
  property gap dimension
  property padding dimension
  property align
    enum start center end stretch baseline
  property justify
    enum start center end space-between space-around space-evenly
  property wrap
    enum true false reverse
  property style element-ref
  children any

grid: kind
  description 'Lays its children out in rows and columns (CSS grid).'
  property columns any
  property rows any
  property areas any
  property gap dimension
  property padding dimension
  property style element-ref
  children any

split: kind
  description 'Two or more panes with draggable dividers.'
  property direction
    enum row column horizontal vertical
  property sizes any
  property min any
  property max any
  property collapsible any
  property collapsed any
  property resizable
    enum true false
  property remember-size string
  property children any
  property label string
  children any

tab-group: kind
  description 'Panels shown one at a time behind a tab strip.'
  property active element-ref
  property label string
  property reorderable
    enum true false
  children any

panel: kind
  description 'A titled panel: a tab of a tab group or a dock panel.'
  property title string
  property closable
    enum true false
  children any

dock: kind
  description 'Docked panels in the regions left, right, top, bottom and center.'
  property persist string
  property float any multi
  property closed any multi
  property label string
  children any

region: kind
  description 'A region of a dock and the panels it shows as tabs.'
  property side
    enum left right top bottom center
  property size dimension
  property collapsed
    enum true false
  property panels any
  property active element-ref
  children none

window: kind
  description 'A floating, movable and resizable surface.'
  property title string
  property open
    enum true false
  property x number
  property y number
  property width number
  property height number
  property closable
    enum true false
  children any

app-shell: kind
  description 'Navigation as a bottom bar, a rail or a drawer, by viewport width.'
  property breakpoints any
  property bottom-bar element-ref
  property rail element-ref
  property drawer element-ref
  property label string
  children any
`;

/** The common properties of the dialect (`note`), declared on every kind. */
function withCommon(kinds, base) {
  const common = [...(base.kinds.get('document')?.properties ?? [])].filter(
    ([name]) => name === 'note'
  );
  for (const kind of kinds.values()) {
    for (const [name, spec] of common) {
      if (!kind.properties.has(name)) {
        kind.properties.set(name, spec);
      }
    }
  }
  return kinds;
}

let cached = null;

/**
 * The ui-dialect vocabulary with the layout kinds (cached). `stack` of the
 * layout vocabulary replaces the basic one: it accepts every value the
 * basic one does, and more.
 * @returns {import('@link-foundation/ui-core').Vocabulary}
 */
export function layoutVocabulary() {
  if (cached === null) {
    const base = defaultVocabulary();
    const layout = withCommon(
      loadVocabulary(LAYOUT_VOCABULARY_TEXT).kinds,
      base
    );
    cached = Object.freeze({
      ...base,
      kinds: new Map([...base.kinds, ...layout]),
    });
  }
  return cached;
}
