// How a link split over lines parses: which sublinks get which values.
import { Parser } from 'links-notation';
const show = (t) =>
  console.log(JSON.stringify(new Parser().parse(t)[0], (k, v) => v));
show(`(c: split (min 20)
  (collapsible true false) (remember-size k)
  (a: text 'A'))`);
show(`(c: split (min 20) (collapsible true false)
  (remember-size k)
  (a: text 'A'))`);
