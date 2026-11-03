// Probe: escapeReference quoting and multi-line forms the chart reader must unfold.
import { Parser, escapeReference, Link } from 'links-notation';
for (const s of [
  '2026-01',
  'Monthly sales',
  "it's",
  'a "b" \'c\'',
  '12',
  '-3.5',
  'a:b',
  '(x)',
  '',
]) {
  console.log(JSON.stringify(s), '->', escapeReference(s));
}
console.log(
  new Link('sales', [
    new Link('chart'),
    new Link(null, [new Link('title'), new Link('Monthly sales')]),
  ]).format()
);
const show = (t) =>
  console.log(
    JSON.stringify(new Parser().parse(t), (k, v) =>
      k === '_isFromPathCombination' ? undefined : v
    )
  );
show(`(x (field month)
   (type temporal))`);
show(`sales: chart
  (title x)
  (mark line)`);
