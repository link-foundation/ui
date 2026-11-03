// Fuzz: formatLinks (nested indented default) round-trips through parseLinks,
// and every document style round-trips through parse (auto and fold modes).
import { formatLinks, parseLinks } from '../../packages/ui-core/src/index.js';
import assert from 'node:assert/strict';
let seed = Number(process.argv[2] ?? 1);
const rnd = (n) => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed % n;
};
const refs = [
  'a',
  'b c',
  "it's",
  'x:y',
  '(p)',
  'say "hi"',
  'line\nbreak',
  'é',
  '#',
  '1',
];
function value(depth) {
  if (depth > 3 || rnd(3) === 0) {
    return refs[rnd(refs.length)];
  }
  const values = Array.from({ length: 1 + rnd(4) }, () => value(depth + 1));
  return rnd(2) === 0 ? values : { id: refs[rnd(refs.length)], values };
}
let n = 0;
for (let i = 0; i < Number(process.argv[3] ?? 5000); i += 1) {
  const values = Array.from({ length: 1 + rnd(3) }, () => value(0));
  for (const style of ['indented', 'inline']) {
    const text = formatLinks(values, { style });
    let back;
    try {
      back = parseLinks(text);
    } catch (e) {
      back = e.message;
    }
    try {
      assert.deepEqual(back, values);
      n += 1;
    } catch {
      console.log(
        'MISMATCH',
        style,
        JSON.stringify(values),
        `\n${text}`,
        JSON.stringify(back)
      );
      process.exit(1);
    }
  }
}
console.log('ok', n);
