/**
 * Whether the JavaScript readers of docs/spec/vocabulary.lino (ui-core and
 * the spec reference projection) read a nested copy of it the same as the
 * original (#133).
 *   node experiments/issue-133/vocabulary-readers.mjs <original> <nested>
 */
import { readFileSync } from 'node:fs';
import { loadVocabulary as coreLoad } from '../../packages/ui-core/src/index.js';
import { loadVocabulary as specLoad } from '../../scripts/spec-reference-projection.mjs';

const [original, nested] = process.argv.slice(2);
const plain = (value) =>
  JSON.stringify(value, (key, v) =>
    v instanceof Map ? Object.fromEntries(v) : v instanceof Set ? [...v] : v
  );
const core = (path) => plain(coreLoad(readFileSync(path, 'utf8')));
const spec = (path) => plain(specLoad(path));
console.log('ui-core same:', core(original) === core(nested));
console.log('spec projection same:', spec(original) === spec(nested));
