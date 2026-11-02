// Probe: how ui-core parseLinks/typeValue read a token set.
import { readFileSync } from 'node:fs';
import { parseLinks, values } from '@link-foundation/ui-core';
const text = readFileSync(
  process.argv[2] ?? 'docs/case-studies/issue-1/samples/tokens.lino',
  'utf8'
);
console.log(JSON.stringify(parseLinks(text), null, 1));
for (const v of [
  "'#6750A4'",
  '16px',
  '150ms',
  '(token a.b)',
  '(oklch 0.6 0.2 300)',
  "'Inter'",
  '400',
  '(cubic 0.4 0 0.2 1)',
]) {
  const raw = values.parseValue(v);
  console.log(v, JSON.stringify(raw), JSON.stringify(values.inferValue(raw)));
}
console.log(
  JSON.stringify(
    parseLinks(
      "(dark: mode (token a 1px))\n(x: theme (mode dark (token a 2px)) (token s (shadow (color '#000') (offset-x 1px))))"
    )
  )
);
