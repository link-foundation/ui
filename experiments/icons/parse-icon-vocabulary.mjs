// Probe: extend the ui-core vocabulary with an `icon` kind and parse
// `(icon close)` and `(ok: icon (set lucide) (name check))`.
import {
  defaultVocabulary,
  loadVocabulary,
  parse,
} from '@link-foundation/ui-core';

const icon = loadVocabulary(`(icon: kind
  (description 'An icon from a registered icon set.')
  (positional name)
  (property name string)
  (property set string)
  (property label string)
  (property mirror (enum true false))
  (children none))`);
const base = defaultVocabulary();
const vocabulary = {
  ...base,
  kinds: new Map([...base.kinds, ...icon.kinds]),
};
const result = parse(
  `(app: document
  (icon close)
  (ok: icon (set lucide) (name check) (label 'Done')))`,
  { vocabulary }
);
console.log(JSON.stringify(result.roots, null, 1));
console.log(result.diagnostics);
