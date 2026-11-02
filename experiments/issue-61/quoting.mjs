// Experiment: how links-notation quotes tricky atoms and whether they round trip.
import { Link, Parser } from 'links-notation';
const samples = [
  '',
  'a b',
  "it's",
  'say "hi"',
  `both ' and "`,
  `all ' " \``,
  'line1\nline2',
  '#FF5500',
  'https://x.y/a?b=1',
  '(x)',
  '{"a":"b\'c"}',
  'tab\tx',
  '1.6',
  ' lead',
  'back\\slash',
  "'''",
  'a:b',
  '#',
];
const p = new Parser();
for (const s of samples) {
  const text = new Link(null, [new Link('v'), new Link(s)]).format();
  let back;
  try {
    back = p.parse(text)[0].values[1].id;
  } catch (e) {
    back = `ERR ${e.message}`;
  }
  console.log(
    JSON.stringify(s).padEnd(28),
    text.padEnd(32),
    back === s ? 'ok' : `MISMATCH ${JSON.stringify(back)}`
  );
}
