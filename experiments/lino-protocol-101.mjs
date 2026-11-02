// Probe: how links-notation reads and writes the documents of the link-cli
// text protocol (empty links, ids, quoted names).
import { Parser, Link } from 'links-notation';

const parser = new Parser();
const show = (v) =>
  v instanceof Link || (v && typeof v === 'object')
    ? { id: v.id, values: (v.values ?? []).map(show) }
    : v;
for (const text of [
  '() ((1: 0 0))',
  '(count: ())',
  "(set-name: (2 'a pair'))",
  '((1: 2 2)) ()',
  "(error: 'Link not found: 7')",
  '1',
  '(count: 2)',
]) {
  const links = parser.parse(text);
  console.log(JSON.stringify(text), JSON.stringify(links.map(show)));
  console.log('  ->', links.map((l) => l.format()).join(' | '));
}
const empty = new Link(null, []);
console.log('empty', JSON.stringify(empty.format()));
console.log(
  new Link(null, [
    new Link(null, []),
    new Link(null, [new Link('1', [new Link('0'), new Link('0')])]),
  ]).format()
);
console.log(new Link('name', [new Link('a pair')]).format());
console.log(new Link('error', [new Link('Link not found: 7')]).format());
