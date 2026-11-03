// How ui-core `format` writes a dock document (the style dockLayoutToLino reuses).
import {
  parse,
  format,
  defaultVocabulary,
  loadVocabulary,
} from '@link-foundation/ui-core';
const layout =
  loadVocabulary(`(dock: kind (property persist string) (property float any multi) (property closed any multi) (children any))
(region: kind (property size dimension) (property collapsed (enum true false)) (property panels any) (children none))`);
const base = defaultVocabulary();
const vocabulary = {
  ...base,
  kinds: new Map([...base.kinds, ...layout.kinds]),
};
const doc = parse(
  `(designer-shell: dock
  (persist 'designer.layout')
  (left: region (size 16rem) (panels toolbox 'my outline'))
  (float x (x 40) (y 60))
  (center: region (panels canvas)))`,
  { vocabulary }
);
console.log(Object.keys(doc));
console.log(format(doc));
