// Print a .lino file in the three format styles.
import { readFileSync } from 'node:fs';
import { format, parse } from '../../packages/ui-core/src/index.js';

const doc = parse(readFileSync(process.argv[2], 'utf8'));
for (const style of ['inline', 'multiline', 'indented']) {
  console.log(`--- ${style}\n${format(doc, { style })}`);
}
