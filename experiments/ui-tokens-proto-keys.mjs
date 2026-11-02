// Token paths and mode names such as __proto__ and constructor are plain
// names: printed "polluted: false", no exception.
// Run: node experiments/ui-tokens-proto-keys.mjs
import { readTokens, resolveTokens, toDtcg } from '@link-foundation/ui-tokens';

for (const text of [
  "(t: theme (token __proto__.polluted '#FFFFFF'))",
  "(t: theme (token constructor.polluted '#FFFFFF'))",
  '(t: theme (token a 1px) (mode __proto__ (token a 2px)))',
]) {
  try {
    const { sets, diagnostics } = readTokens(text);
    const json = toDtcg(resolveTokens(sets, 't'));
    console.log(
      diagnostics.map((d) => d.code),
      JSON.stringify(json).slice(0, 80),
      'polluted:',
      {}.polluted !== undefined || Object.polluted !== undefined
    );
  } catch (error) {
    console.log('threw:', error.message);
  }
}
