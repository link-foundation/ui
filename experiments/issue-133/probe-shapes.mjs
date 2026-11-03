// Probe how links-notation reads small indented documents with parse() and
// parseGroups() + unindent, and how Link.format(lessParentheses) writes links.
import { Link, Parser } from 'links-notation';

const unindent = ({ element, children }) =>
  children.length > 0
    ? new Link(element.id, [...element.values, ...children.map(unindent)])
    : element;
const p = new Parser();
const show = (links) => links.map((l) => l.format()).join(' | ');
const cases = [
  'a',
  'a b',
  'x: a b',
  'x:',
  '(a)',
  'a\n  b c',
  'a b\n  c d',
  'a b\n  c',
  'a b\n  (c)',
  'x: a\n  b c\n    d e',
  '(a b)\n  c d',
  '(x y) z',
  'a b\n  c: d',
  "label 'a b'",
  'on press\n  emit save\n  navigate home',
  '(a b c)\n  (d)',
];
for (const text of cases) {
  console.log(JSON.stringify(text));
  console.log('  parse      :', show(p.parse(text)));
  console.log('  groups     :', show(p.parseGroups(text).map(unindent)));
}
for (const link of [
  new Link(null, [new Link('a')]),
  new Link(null, [new Link('a'), new Link('b')]),
  new Link('x', [
    new Link('a'),
    new Link(null, [new Link('b'), new Link('c')]),
  ]),
  new Link('x', []),
  new Link(null, [
    new Link(null, [new Link('x'), new Link('y')]),
    new Link('z'),
  ]),
  new Link('a b', [new Link('c d')]),
]) {
  console.log(
    link.format(),
    '=> lessParentheses:',
    JSON.stringify(link.format(true))
  );
}
