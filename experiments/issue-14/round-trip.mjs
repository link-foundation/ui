// parse(format(parse(t))) vs parse(t) for every fixture and style.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { format, parse, toTree } from '../../packages/ui-core/src/index.js';

const root = 'docs/spec/fixtures';
const shape = (doc) => JSON.stringify({ e: doc.roots, u: doc.unknown });
let bad = 0;
for (const area of readdirSync(root)) {
  for (const file of readdirSync(join(root, area)).filter((f) =>
    f.endsWith('.lino')
  )) {
    const doc = parse(readFileSync(join(root, area, file), 'utf8'));
    for (const style of ['inline', 'multiline', 'indented']) {
      const text = format(doc, { style });
      const again = parse(text);
      if (shape(again) !== shape(doc)) {
        bad++;
        console.log(`MISMATCH ${area}/${file} [${style}]`);
        if (process.argv[2]) {
          console.log(
            text,
            JSON.stringify(toTree(again)),
            '\n',
            JSON.stringify(toTree(doc))
          );
        }
      }
    }
  }
}
console.log(bad ? `${bad} mismatches` : 'all round trips match');
