// Print parse() and parseGroups() output of a .lino file (issue 14 study).
import { readFileSync } from 'node:fs';
import { Parser } from 'links-notation';
const p = new Parser();
const src = readFileSync(process.argv[2], 'utf8');
const show = (g, pad = '') => {
  console.log(
    `${pad}${g.element.format()}  [id=${JSON.stringify(g.element.id)} n=${g.element.values.length}]`
  );
  g.children.forEach((c) => show(c, `${pad}  `));
};
console.log('parse():');
p.parse(src).forEach((l) => console.log(' ', l.format()));
console.log('parseGroups():');
p.parseGroups(src).forEach((g) => show(g, '  '));
