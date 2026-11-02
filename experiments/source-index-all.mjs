// Index every sample and spec fixture; report the ones that fail.
import { indexSource } from '../packages/ui-core/src/source/index.js';
import { samples, specFixtures } from '../packages/ui-core/tests/helpers.js';
import { parse } from '../packages/ui-core/src/parse.js';

let ok = 0;
const fail = [];
for (const { name, text } of [...samples(), ...specFixtures()]) {
  const doc = parse(text);
  const syntax = doc.diagnostics.some((d) =>
    ['syntax-error', 'depth-exceeded', 'input-too-large'].includes(d.code)
  );
  try {
    indexSource(text);
    ok++;
  } catch (e) {
    fail.push(`${name}${syntax ? ' [syntax]' : ''}: ${e.message}`);
  }
}
console.log('ok', ok);
console.log(fail.join('\n'));
