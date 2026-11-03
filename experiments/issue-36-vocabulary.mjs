// The issue-36 layout sample parsed by ui-core with an extended vocabulary.
import {
  parse,
  loadVocabulary,
  defaultVocabulary,
} from '@link-foundation/ui-core';
import { escapeReference } from 'links-notation';
const layout = loadVocabulary(`(dock: kind
  (property persist string)
  (property float any multi)
  (property closed any multi)
  (children any))
(region: kind
  (property size dimension)
  (property collapsed (enum true false))
  (property panels any)
  (children none))
(split: kind
  (property direction (enum row column))
  (property resizable (enum true false))
  (property remember-size string)
  (property children any)
  (property sizes any)
  (children any))`);
const base = defaultVocabulary();
const vocabulary = {
  ...base,
  kinds: new Map([...base.kinds, ...layout.kinds]),
};
const r = parse(
  `(designer-shell: dock
  (persist 'designer.layout')
  (left: region (size 16rem) (panels toolbox outline))
  (center: region (panels canvas))
  (float toolbox (x 40) (y 60))
  (closed problems bottom))
(chat-screen: split
  (direction row)
  (resizable true)
  (remember-size 'chat.columns')
  (sizes 30 70)
  (children chat-list conversation))`,
  { vocabulary }
);
console.log(JSON.stringify(r.roots, null, 0));
console.log(r.diagnostics);
console.log(
  ['designer.layout', 'a b', "it's", '16rem', '(x)'].map(escapeReference)
);
