// Finite boundary matrix for empty, unary, quoted and literal references.
import assert from 'node:assert/strict';
import {
  linoToNetwork,
  networkToLino,
} from '../../packages/ui-components/src/links-view/lino-to-network.js';
const inputs = [
  '',
  '# only a comment',
  '()',
  'a:',
  'a: () ()',
  'a: (empty:) ()',
  'a: (b) c',
  'a: b\n  c',
  'a: (b:)\n  c:',
  "'two words': b c",
  "'': b c",
  'a: ~bare ~1{00}',
  "a: '''one'two''' `three`",
  'a: 日本語 "🦊"',
  'a: a/1 a/0\n  b c',
  'a: a a\na: discarded ignored',
  '(a: b\n  (c: d e)\n  (f g))',
];
for (const text of inputs) {
  const first = linoToNetwork(text);
  assert.ok(!first.diagnostics.some((d) => d.severity === 'error'), text);
  const formatted = networkToLino(first);
  assert.deepEqual(
    linoToNetwork(formatted).links,
    first.links,
    JSON.stringify({ text, formatted })
  );
}
console.log(`${inputs.length} boundary round trips passed`);
