import { readFileSync } from 'node:fs';
import { parse } from '@link-foundation/ui-core';
import { createStore } from '@link-foundation/ui-store';
const t = readFileSync(
  'docs/case-studies/issue-1/samples/document.lino',
  'utf8'
);
const d = parse(t);
console.log(JSON.stringify(d.roots, null, 1), d.diagnostics);
const s = createStore({ document: d });
console.log(s.roots(), s.children('app'), s.get('body'));
s.subscribe((e) => console.log(JSON.stringify(e)));
s.setProp('greeting', 'text', ['Hi']);
console.log(JSON.stringify(parse("(x: text 'a <b>')").roots));
console.log(
  JSON.stringify(parse("(x: image (src 'a.png'))").roots),
  parse("(x: image (src 'a.png'))").diagnostics
);
console.log(
  JSON.stringify(parse('(x: foo (bar 1))').roots),
  parse('(x: foo (bar 1))').diagnostics
);
