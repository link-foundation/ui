// Does Parser.parse read an indented id block the same as Parser.parseGroups
// (folding the children of each group into its element)? Run with any
// links-notation version on the module path.
import { Link, Parser } from 'links-notation';

const parser = new Parser();
const unindent = ({ element, children }) =>
  children.length > 0
    ? new Link(element.id, [...element.values, ...children.map(unindent)])
    : element;
const show = (links) => links.map((link) => link.format()).join(' | ');

for (const text of [
  'x:\n  a\n  b',
  'x: kind\n  a\n  b',
  'x: kind\n  a 1\n  b 2',
  'x: kind\n  a 1\n    c 3',
  'a b\n  c d',
]) {
  const parsed = parser.parse(text);
  const grouped = parser.parseGroups(text).map(unindent);
  const same =
    parsed.length === grouped.length &&
    parsed.every((link, i) => link.equals(grouped[i]));
  console.log(
    `${JSON.stringify(text)}\n  parse      : ${show(parsed)}\n  parseGroups: ${show(grouped)}\n  same: ${same}`
  );
}
