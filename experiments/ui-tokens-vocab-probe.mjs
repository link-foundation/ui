// Probe: ui-core parse() of token sets with `mode` declared as a multi-valued theme property.
import {
  parse,
  defaultVocabulary,
  formatLinks,
} from '@link-foundation/ui-core';
const base = defaultVocabulary();
const theme = base.kinds.get('theme');
const vocabulary = {
  ...base,
  kinds: new Map(base.kinds).set('theme', {
    ...theme,
    properties: new Map(theme.properties).set('mode', {
      type: 'any',
      multi: true,
    }),
  }),
  multiValued: new Set([...base.multiValued, 'mode']),
};
const indented = `m3: theme
  extends base
  token color.primary '#6750A4'
  mode dark
    token color.primary '#D0BCFF'
    token x 1px
  mode light
    token x 2px
(other: stack)`;
const multi = `(m3: theme (extends base other) (token a 1px (description 'It''s "x"')) (mode dark (token a 2px)) (mode dark (token b 3px)))`;
for (const t of [indented, multi]) {
  const doc = parse(t, { checks: false, vocabulary });
  console.log(JSON.stringify(doc.roots), JSON.stringify(doc.diagnostics));
}
console.log(
  formatLinks([
    {
      id: 'm3',
      values: ['theme', ['token', 'a', '#FFF', ['description', 'It\'s "x"']]],
    },
  ])
);
console.log(
  JSON.stringify(
    parse("(m3: theme (extends base) (token a '#6750A4'))").diagnostics
  )
);
