// Compares the links-notation output of the single-line and multi-line
// forms of a diagram, and lists the Link fields (positions?).
import { Parser } from 'links-notation';
const p = new Parser();
const one = p.parse(
  `(f: diagram (kind flowchart) (a: node (label 'A')) (edge (from a) (to b)))`
);
console.log(one.map(String).join('\n'));
console.log(Object.keys(one[0]));
const multi = p.parse(
  `(f: diagram\n  (a: node (label 'A b'))\n  (edge (from a)\n    (to b)))`
);
console.log(multi.map(String).join('\n'));
