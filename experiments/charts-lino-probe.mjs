// Probe: the shape of links-notation Link objects for a chart document.
import { Parser } from 'links-notation';
const text = `(sales: chart
  (title 'Monthly sales')
  (data
    (row (month 2026-01) (value 12)))
  (mark line)
  (encoding
    (x (field month) (type temporal))))`;
const links = new Parser().parse(text);
console.log(JSON.stringify(links, null, 1).slice(0, 1500));
console.log(
  Object.keys(links[0]),
  links[0].constructor.name,
  typeof links[0].format
);
console.log(links[0].format?.());
