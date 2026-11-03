// Probe: Parser#parseGroups keeps a multi-line link as one nested link?
import { Parser } from 'links-notation';
const text = `(sales: chart
  (title 'Monthly sales')
  (data
    (row (month 2026-01) (value 12))
    (row (month 2026-02) (value 18)))
  (mark line))

(other: chart (mark bar))`;
const g = new Parser().parseGroups(text);
console.log(g.length, JSON.stringify(g).slice(0, 600));
for (const x of g) {
  console.log(typeof x.format === 'function' ? x.format() : x);
}
