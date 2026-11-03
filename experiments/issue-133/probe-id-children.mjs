import { Link, Parser } from 'links-notation';
const unindent = ({ element, children }) => children.length > 0 ? new Link(element.id, [...element.values, ...children.map(unindent)]) : element;
const p = new Parser();
for (const t of ['x:\n  a\n  b', 'x:\n  a b\n  c', 'x: y\n  a', 'x:\n  a\n    b c']) {
  console.log(JSON.stringify(t), '| parse:', p.parse(t).map(l=>l.format()).join(' | '), '| groups:', p.parseGroups(t).map(unindent).map(l=>l.format()).join(' | '));
}
