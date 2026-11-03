// The shape of resolved ui-tokens values for the issue-1 sample theme.
import { readFileSync } from 'node:fs';
import { readTokens, resolveTokens } from '@link-foundation/ui-tokens';
const text = readFileSync(
  'docs/case-studies/issue-1/samples/tokens.lino',
  'utf8'
);
const { sets, diagnostics } = readTokens(text);
const resolved = resolveTokens(sets, 'material3');
console.log(diagnostics, resolved);
console.log(resolved.tokens?.get?.('motion.duration.short'));
