import { readFileSync } from 'node:fs';
import { readStyles, compileCss } from '@link-foundation/ui-style';
const t = readFileSync('docs/case-studies/issue-1/samples/styles.lino', 'utf8');
const r = readStyles(t);
console.log(JSON.stringify(r, null, 1).slice(0, 1500));
console.log(compileCss(r.rules));
const t2 = `(card-style: style
  (selector (type card) (within (type dialog)))
  (padding (token space.medium))
  (media (max-width 640px)
    (padding (token space.small))
    (state hover (opacity 0.5)))
  (container (min-width 400px)
    (direction horizontal))
  (state disabled (opacity 0.38)))
(bad: style (selector (type button)) (state :hover (elevation 2)) (media (max-width: 640px) (padding 1px)) (foo 1) (background 'url(x)'))`;
const r2 = readStyles(t2);
console.log(r2.diagnostics.map((d) => `${d.code}: ${d.message}`));
console.log(compileCss(r2.rules));
