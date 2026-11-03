// Probe: how single-reference and parenthesized child lines read back in
// parse() and parseGroups()+unindent, for the nested formatter design.
import { Link, Parser } from 'links-notation';
const unindent = ({ element, children }) =>
  children.length > 0
    ? new Link(element.id, [...element.values, ...children.map(unindent)])
    : element;
const cases = [
  'ok: button\n  disabled\n  label OK',
  'ok: button\n  (disabled)\n  label OK',
  'x:\n  a\n  b',
  'x:\n  (a)\n  (b)',
  'a b\n  c',
  '"a b": c\n  d e',
  '"a b":\n  d e',
  '((b c))',
  '((b c))\n  d e',
  '(a b) (c d)',
  'a\n  "line1\nline2" x\n  y z',
  'a "line1\n  line2"\n  y z',
  'a\n  b\n    c d\n  e f',
  '(name:)',
  'x: (y: z)\n  w: q r',
];
const p = new Parser();
for (const text of cases) {
  let a, b;
  try {
    a = p
      .parse(text)
      .map((l) => l.format())
      .join(' | ');
  } catch (e) {
    a = `ERR ${e.message}`;
  }
  try {
    b = p
      .parseGroups(text)
      .map(unindent)
      .map((l) => l.format())
      .join(' | ');
  } catch (e) {
    b = `ERR ${e.message}`;
  }
  console.log(JSON.stringify(text), '\n  parse :', a, '\n  groups:', b);
}
