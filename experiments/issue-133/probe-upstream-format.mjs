// Does links-notation's own formatter write the nested (indented) form, and
// does that text read back as the same links?
import { Link, Parser, FormatOptions, formatLinks } from 'links-notation';

const unindent = ({ element, children }) =>
  children.length > 0
    ? new Link(element.id, [...element.values, ...children.map(unindent)])
    : element;
const parser = new Parser();
const source = `(form: stack (direction vertical) (gap 8px) (title: text 'Sign in') (save: button 'Save' (on press (emit save) (navigate home))))
(nested ((b c)))`;
const links = parser.parse(source);
for (const opts of [
  { lessParentheses: true },
  { lessParentheses: true, maxInlineRefs: 1 },
  { lessParentheses: true, indentLongLines: true, maxLineLength: 20 },
  { lessParentheses: true, maxInlineRefs: 2, indentLongLines: true, maxLineLength: 20 },
]) {
  const text = formatLinks(links, new FormatOptions(opts));
  console.log('options', JSON.stringify(opts));
  console.log(text);
  let back;
  try {
    back = parser.parseGroups(text).map(unindent);
  } catch (e) {
    back = e.message;
  }
  const same =
    Array.isArray(back) &&
    back.length === links.length &&
    back.every((l, i) => l.equals(links[i]));
  console.log('  reads back as the same links:', same);
  if (!same && Array.isArray(back)) console.log('  read back:', back.map((l) => l.format()).join(' | '));
}
