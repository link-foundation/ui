// Shapes of ui-style entries and ui-tokens resolved tokens (#54).
import { readFileSync } from 'node:fs';
import { readStyles, flatten, matches } from '@link-foundation/ui-style';
import { readTokens, resolveTokens } from '@link-foundation/ui-tokens';
import { parse, values } from '@link-foundation/ui-core';
const s = (n) =>
  readFileSync(
    new globalThis.URL(
      `../docs/case-studies/issue-1/samples/${n}.lino`,
      import.meta.url
    ),
    'utf8'
  );
const { rules } = readStyles(s('styles'));
const e = flatten(rules);
console.log(JSON.stringify(e, null, 1).slice(0, 2500));
const { sets, diagnostics } = readTokens(s('tokens'));
console.log(diagnostics);
const t = resolveTokens(sets, 'material3');
console.log(t.get('color.primary'), t.get('space.medium'));
const doc = parse(s('document'));
console.log(matches(e[0].selector, doc.byId.get('ok'), []));
console.log(typeof values.formatValue, Object.keys(values));
