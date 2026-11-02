import { parse, values } from '@link-foundation/ui-core';
const t = `(card-style: style
  (selector (type card) (within (type dialog)))
  (padding (token space.medium))
  (media (max-width 640px)
    (padding (token space.small)))
  (media (max-width: 640px) (padding 1px))
  (container (min-width 400px)
    (direction horizontal))
  (state disabled (opacity 0.38)))
card-style
  (gap 4px)`;
const d = parse(t);
console.log(JSON.stringify(d.roots, null, 0), d.diagnostics);
console.log(
  values.toCss(values.parseColor('#6750A4')),
  values.toCss({ type: 'number', value: 0.98 })
);
