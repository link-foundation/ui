// Usage of @link-foundation/ui-tokens: read a token set with an alias, a
// parent set and a dark mode, then write it as CSS, DTCG, Swift and Kotlin.
// Run: node examples/ui-tokens-basics.mjs
import {
  fromDtcg,
  readTokens,
  resolveTokens,
  toCss,
  toDtcg,
  toKotlin,
  toSwift,
} from '@link-foundation/ui-tokens';

const text = `
(base: theme
  (token space.small 8px))

(brand: theme
  (extends base)
  (token color.primary '#6750A4' (description 'Brand colour'))
  (token color.action (token color.primary))
  (token space.gap (token space.small))
  (token motion.duration.short 150ms)
  (mode dark
    (token color.primary '#D0BCFF')))
`;

const { sets, diagnostics } = readTokens(text);
console.log('read diagnostics:', diagnostics.length); // 0

const resolved = resolveTokens(sets, 'brand');
console.log(resolved.get('color.action').value); // the colour of color.primary
console.log([...resolved.modes.get('dark').keys()]); // ['color.primary', 'color.action']

console.log(
  toCss(resolved, { modeMedia: { dark: '(prefers-color-scheme: dark)' } })
);

const dtcg = toDtcg(resolved);
console.log(JSON.stringify(dtcg.color.action)); // {"$type":"color","$value":"{color.primary}"}
console.log(fromDtcg(dtcg, { id: 'brand' }));

console.log(toSwift(resolved));
console.log(toKotlin(resolved, { packageName: 'com.example.tokens' }));

// An alias cycle is a diagnostic, never an exception.
const cyclic = readTokens('(t: theme (token a (token b)) (token b (token a)))');
for (const d of resolveTokens(cyclic.sets, 't').diagnostics) {
  console.log(d.code, d.message);
}
