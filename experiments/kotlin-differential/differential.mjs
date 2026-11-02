// Differential test of the Kotlin port against the JavaScript links-notation
// parser. Usage: node differential.mjs <count> <seed> <maxDepth>
// Writes inputs.txt, runs the Kotlin side (run.sh), and compares.
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { Parser, formatLinks } from 'links-notation';

const count = Number(process.argv[2] ?? 2000);
let seed = Number(process.argv[3] ?? 1);
const maxDepth = Number(process.argv[4] ?? 64);
const rand = () =>
  (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const pick = (a) => a[Math.floor(rand() * a.length)];
const atoms = [
  'a',
  'b',
  'id',
  ' ',
  '  ',
  '\t',
  '\n',
  '\r\n',
  '\r',
  '(',
  ')',
  ':',
  '"',
  "'",
  '`',
  '""',
  "''",
  '#',
  ' #c',
  '~1{41}',
  '~1{zz}',
  '~2{41}',
  '~1{',
  '~',
  'é',
  '😀',
  '\ud800',
  '\n  ',
  '\n    ',
  '\n ',
  'x: y',
  '((',
  '))',
  '"a b"',
  "'it''s'",
  '``x``',
  '\u00a0',
  '\u2028',
  '\ufeff',
  '\u0001',
];
const fixed = [
  '',
  'a',
  '(a b)',
  'a: b c',
  'a:\n  b\n  c',
  'a\n  b\n    c\n  d',
  '(a: b: c)',
  '((a))',
  '(a\n  b)',
  '"unterminated',
  "'''x'''",
  '~1{c3a9}',
  '~1{ff}',
  '( a )',
  'a #c\nb',
  'a b\n\n\nc',
  '  a\n  b',
  ' a\nb',
  'a\n\tb',
  '(a:\n  b\n  c)',
  'x: (a b) c',
];
const inputs = [...fixed];
for (let i = 0; i < count; i++) {
  let s = '';
  const n = 1 + Math.floor(rand() * 12);
  for (let j = 0; j < n; j++) {
    s += pick(atoms);
  }
  inputs.push(s);
}
const hex = (s) =>
  Array.from({ length: s.length }, (_, i) =>
    s.charCodeAt(i).toString(16).padStart(4, '0')
  ).join('');
const tree = (l) =>
  `[${l.id === null || l.id === undefined ? 'null' : hex(l.id)}${(l.values ?? []).map((v) => `,${tree(v)}`).join('')}]`;
writeFileSync('inputs.txt', `${inputs.map(hex).join('\n')}\n`);
const parser = new Parser({ maxDepth });
const js = inputs.map((input) => {
  try {
    const links = parser.parse(input);
    let f;
    try {
      f = hex(formatLinks(links));
    } catch {
      f = 'FORMATERR';
    }
    return `OK ${links.map(tree).join('')} ${f}`;
  } catch (e) {
    if (e.line === undefined) {
      return `OTHER ${e.message}`;
    }
    return `${e.maxDepth !== undefined && e.maxDepth !== null ? 'DEPTH' : 'SYNTAX'} ${e.line} ${e.column} ${hex(e.message)}`;
  }
});
const kt = execFileSync('sh', ['run.sh', 'inputs.txt', String(maxDepth)], {
  maxBuffer: 1 << 28,
})
  .toString()
  .split('\n');
let bad = 0;
for (let i = 0; i < inputs.length; i++) {
  if (
    js[i] !== kt[i] &&
    !(js[i].startsWith('OTHER') && kt[i].startsWith('SYNTAX'))
  ) {
    if (bad++ < 10) {
      console.log(
        JSON.stringify(inputs[i]),
        '\n  js:',
        js[i].slice(0, 300),
        '\n  kt:',
        (kt[i] ?? '').slice(0, 300)
      );
    }
  }
}
const others = js.filter((r) => r.startsWith('OTHER')).length;
console.log('JS non-located messages:', [
  ...new Set(js.filter((r) => r.startsWith('OTHER'))),
]);
console.log(
  `${inputs.length} inputs, ${bad} mismatches, ${others} JS non-located errors (Kotlin: Syntax)`
);
process.exit(bad ? 1 : 0);
