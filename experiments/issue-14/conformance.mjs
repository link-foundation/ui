// Compare parse() output with every spec fixture; print mismatches.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse, toTree } from '../../packages/ui-core/src/parse.js';

const root = 'docs/spec/fixtures';
const sortD = (ds) => ds.map((d) => JSON.stringify(d)).sort();
let bad = 0;
for (const area of readdirSync(root)) {
  for (const file of readdirSync(join(root, area)).filter((f) => f.endsWith('.lino'))) {
    const base = join(root, area, file.slice(0, -5));
    const text = readFileSync(`${base}.lino`, 'utf8');
    for (const mode of ['auto', 'fold']) {
      const tree = toTree(parse(text, { mode }));
      let expected;
      let actual;
      if (existsSync(`${base}.tree.json`)) {
        expected = JSON.parse(readFileSync(`${base}.tree.json`, 'utf8'));
        expected.diagnostics = sortD(expected.diagnostics);
        actual = { ...tree, diagnostics: sortD(tree.diagnostics) };
      } else {
        expected = sortD(JSON.parse(readFileSync(`${base}.diagnostics.json`, 'utf8')).diagnostics);
        actual = sortD(tree.diagnostics);
      }
      if (JSON.stringify(expected) !== JSON.stringify(actual)) {
        bad++;
        console.log(`MISMATCH ${base} [${mode}]`);
        if (process.argv[2]) {
          console.log(JSON.stringify(expected, null, 1));
          console.log(JSON.stringify(actual, null, 1));
        }
      }
    }
  }
}
console.log(bad ? `${bad} mismatches` : 'all fixtures match');
