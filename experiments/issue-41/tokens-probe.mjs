import { readTokens, resolveTokens, toCss } from '@link-foundation/ui-tokens';
const { sets, diagnostics } = readTokens(`(links: theme
  (token color.link.line '#37474F')
  (token color.link.grid.major '#FFFFFF')
  (mode dark (token color.link.line '#ECEFF1')))`);
console.log(diagnostics);
const r = resolveTokens(sets, 'links', { mode: 'dark' });
console.log(r, toCss(r));
