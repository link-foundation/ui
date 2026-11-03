// Bounded probes for shared override limits; at most 20 nested links / 66 KiB.
import { validateOverrides } from '../packages/ui-devmode/src/validate.js';
import { parse } from '@link-foundation/ui-core';
const schema = parse('app: document\n  ok: button\n    label OK');
for (const [name, input] of [
  ['size', 'x'.repeat(65537)],
  ['parentheses', `${'('.repeat(20)}a b${')'.repeat(20)}`],
  [
    'indentation',
    Array.from({ length: 20 }, (_, n) => `${'  '.repeat(n)}a b`).join('\n'),
  ],
]) {
  console.log(name, validateOverrides(input, { schema }).rejected);
}
