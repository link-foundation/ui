import {
  parse,
  format,
  parseLinks,
  formatLinks,
} from '@link-foundation/ui-core';
import { readFileSync } from 'node:fs';
const t = readFileSync(
  'docs/case-studies/issue-1/samples/overrides.lino',
  'utf8'
);
const d = parse(t);
console.log(JSON.stringify(d.roots, null, 1), d.diagnostics, d.unknown);
console.log(format(d));
console.log(JSON.stringify(parseLinks(t)));
console.log(formatLinks(parseLinks(t)));
const doc = parse(
  readFileSync('docs/case-studies/issue-1/samples/document.lino', 'utf8') +
    readFileSync('docs/case-studies/issue-1/samples/tokens.lino', 'utf8')
);
console.log(JSON.stringify(doc.roots[1]), doc.diagnostics);
