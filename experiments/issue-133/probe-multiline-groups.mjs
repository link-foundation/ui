// How parse() and parseGroups()+unindent read the parenthesized multiline
// form and the nested form (#133).
import { Link, Parser } from 'links-notation';
const unindent = ({ element, children }) =>
  children.length > 0 ? new Link(element.id, [...element.values, ...children.map(unindent)]) : element;
const p = new Parser();
for (const text of [
  '(r: rule\n  (match (A))\n  (replace (a)))\n',
  'r: rule\n  match\n    A\n  replace\n    a\n',
  '(mui: mapping (x y))\n(r: rule (match (A)) (replace (a)))\n',
]) {
  console.log(JSON.stringify(text));
  console.log('  parse :', p.parse(text).map((l) => l.format()).join(' | '));
  console.log('  groups:', p.parseGroups(text).map(unindent).map((l) => l.format()).join(' | '));
}
