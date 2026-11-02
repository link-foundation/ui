import { readFileSync } from 'node:fs';
import { readRecords } from '../../packages/ui-settings/src/read.js';
const text = readFileSync(
  process.argv[2] ??
    new globalThis.URL(
      '../../packages/ui-settings/tests/fixtures/demo.schema.lino',
      import.meta.url
    ),
  'utf8'
);
for (const r of readRecords(text).records) {
  console.log(JSON.stringify(r));
}
