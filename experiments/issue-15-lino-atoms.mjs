// Probe how links-notation 0.27.1 parses single values and formats atoms.
import { Parser, Link } from 'links-notation';
const p = new Parser();
const show = (t) => {
  try {
    const r = p.parse(t);
    console.log(
      JSON.stringify(t),
      '=>',
      JSON.stringify(
        r.map((l) => [l.id, l.values.map((v) => [v.id, v.values.length])])
      )
    );
  } catch (e) {
    console.log(JSON.stringify(t), 'ERR', e.message.split('\n')[0]);
  }
};
for (const t of [
  '16px',
  "'#6750A4'",
  '(token a.b)',
  '(oklch 0.6 0.2 300)',
  "'a b'",
  '-1',
  '1e+21',
  '"it\'s"',
  "'x:y'",
  '@a',
  '(a)',
  'a b',
  '(rgb 1 2 3 0.5)',
]) {
  show(t);
}
for (const s of [
  '#6750A4',
  'a b',
  'x:y',
  "it's",
  'a"b\'c',
  'plain',
  '-1',
  '(',
  '',
  'a.b',
]) {
  console.log(JSON.stringify(s), '->', new Link(s).format());
}
console.log(new Link(null, [new Link('token'), new Link('a.b')]).format());
