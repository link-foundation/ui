// Print what the readers of the ui-convert LiNo files read from them, so the
// nested rewrite (#133) can be checked to read the same:
//   node experiments/issue-133/consumer-snapshot.mjs > before.json
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { readRules } from '../../packages/ui-convert/src/rules.js';
import { readTable } from '../../packages/ui-convert/src/interop/mapping.js';
import { loadVocabulary } from '../../packages/ui-core/src/index.js';

const read = (file) =>
  readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
const vocab = (file) => {
  const v = loadVocabulary(read(file));
  return {
    version: v.version,
    actions: [...v.actions],
    multiValued: [...v.multiValued],
    kinds: [...v.kinds].map(([k, d]) => [
      k,
      JSON.stringify(d, (_, x) =>
        x instanceof Map ? [...x] : x instanceof Set ? [...x] : x
      ),
    ]),
  };
};
const out = {
  mui: readRules(read('packages/ui-convert/src/mappings/mui.lino')),
  muiVocabulary: vocab('packages/ui-convert/src/mappings/vocabulary.lino'),
  interopVocabulary: vocab('packages/ui-convert/src/interop/vocabulary.lino'),
};
for (const name of ['a2ui', 'adaptive-cards', 'json-forms', 'lottie']) {
  out[name] = readTable(
    read(`packages/ui-convert/src/interop/${name}/mapping.lino`)
  );
}
console.log(JSON.stringify(out, null, 1));
