import { Link, Parser } from 'links-notation';
const unindent = ({ element, children }) =>
  children.length > 0
    ? new Link(element.id, [...element.values, ...children.map(unindent)])
    : element;
const j = (l) =>
  l.values.length === 0 ? l.id : { id: l.id, v: l.values.map(j) };
const p = new Parser();
for (const t of [
  'a',
  'x:',
  'x:\n  b c',
  'x: a',
  '(x: a)\n  b c',
  '((b c))',
  '(x)',
  'a\n  b',
  "'a b'",
  "'a: b'",
  '(a\n  b c\n  d)',
  '(a: b\n  (c d)\n  (e f))',
]) {
  console.log(
    JSON.stringify(t),
    'parse',
    JSON.stringify(p.parse(t).map(j)),
    'groups',
    JSON.stringify(p.parseGroups(t).map(unindent).map(j))
  );
}
console.log(
  new Link(null, [new Link(null, [new Link('b'), new Link('c')])]).format(true)
);
console.log(
  new Link('x', [new Link(null, [new Link('b'), new Link('c')])]).format(true)
);
