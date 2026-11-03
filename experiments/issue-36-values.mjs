import { parse } from '@link-foundation/ui-core';
import { layoutVocabulary } from '@link-foundation/ui-components';
const d = parse(
  `(g: grid (columns (repeat 3 1fr) 2fr) (areas 'a b' 'c d') (gap 8px))
(s: split (sizes 30 70) (min 10 20) (collapsible true false) (remember-size 'chat.split'))
(sh: app-shell (breakpoints 640 1024) (rail nav) (nav: stack))`,
  { vocabulary: layoutVocabulary() }
);
console.log(
  JSON.stringify(
    d.roots.map((r) => ({ id: r.id, kind: r.kind, props: r.properties })),
    null,
    0
  )
);
console.log(d.diagnostics);
