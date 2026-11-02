// Smoke test of ui-tokens: read, resolve, every exporter and the DTCG round
// trip of one token file.
// node experiments/ui-tokens-smoke.mjs packages/ui-tokens/tests/fixtures/full.lino brand
import { readFileSync } from 'node:fs';
import {
  fromDtcg,
  readTokens,
  resolveTokens,
  toCss,
  toDtcg,
  toKotlin,
  toSwift,
} from '@link-foundation/ui-tokens';

const [file, setId] = process.argv.slice(2);
const { sets, diagnostics } = readTokens(readFileSync(file, 'utf8'));
console.log('read', diagnostics);
const resolved = resolveTokens(sets, setId);
console.log('resolve', resolved.diagnostics);
console.log(toCss(resolved));
const dtcg = toDtcg(resolved);
console.log(JSON.stringify(dtcg, null, 2));
console.log(toSwift(resolved));
console.log(toKotlin(resolved, { packageName: 'com.example.tokens' }));
const lino = fromDtcg(dtcg, { id: setId });
console.log(lino);
const back = readTokens(lino);
const again = resolveTokens(back.sets, setId);
const key = (tokens) =>
  JSON.stringify(
    [...tokens.values()]
      .map(({ path, type, value, raw, alias, description }) => ({
        path,
        type,
        value,
        raw,
        alias,
        description,
      }))
      .sort((a, b) => a.path.localeCompare(b.path))
  );
console.log('lossless', key(resolved) === key(again));
for (const [mode, tokens] of resolved.modes) {
  console.log('lossless', mode, key(tokens) === key(again.modes.get(mode)));
}
