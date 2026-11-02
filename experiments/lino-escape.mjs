// Experiment: how links-notation quotes awkward values and whether they read back.
import { Link, Parser, escapeReference } from 'links-notation';
const samples = [
  'a\nb',
  '.card { color: red; }\n.x{}',
  'it\'s "q"',
  '',
  'OK',
  '#3390ec',
  'Привет, мир',
  '👋 hi',
  'a)b',
  '0 auto',
  'x:y',
];
for (const s of samples) {
  const link = new Link('e', [new Link('raw-css'), new Link(s)]);
  const text = link.format();
  let back;
  try {
    back = new Parser().parse(`(${text.slice(1)}`)[0].values[1].id;
  } catch (e) {
    back = `ERR ${e.message}`;
  }
  console.log(
    JSON.stringify(s),
    '->',
    escapeReference(s),
    '|',
    text,
    '| back ok:',
    back === s,
    JSON.stringify(back)
  );
}
