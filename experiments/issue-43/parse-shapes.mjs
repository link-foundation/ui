// Bounded probe: raw groups, normalisation and source tokens for the converter.
import { Parser, stripComments } from 'links-notation';
import {
  normalizeLink,
  scanDelimiters,
} from '../../packages/ui-core/src/source.js';
import { unindent } from '../../packages/ui-core/src/links.js';
const inputs = [
  '(a: b (c d))',
  '(a: b\n  (c d))',
  'a: b\n  c d',
  'a',
  '(a:)',
  '()',
  "(a: 'b' c)\n(b: b b)",
];
for (const text of inputs) {
  console.log(
    JSON.stringify({
      text,
      links: new Parser().parseGroups(text).map(unindent).map(normalizeLink),
      tokens: scanDelimiters(stripComments(text)).tokens,
    })
  );
}
