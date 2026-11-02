// Round-trip the JSON Forms fixtures and print the LiNo and diagnostics.
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { deepStrictEqual } from 'node:assert';
import { parse } from '@link-foundation/ui-core';
import { importJsonForms } from '../../packages/ui-convert/src/interop/json-forms/import.js';
import {
  exportJsonForms,
  normalizeJsonForms,
} from '../../packages/ui-convert/src/interop/json-forms/export.js';
import { interopVocabulary } from '../../packages/ui-convert/src/interop/vocabulary.js';

const dir = new URL(
  '../../packages/ui-convert/tests/fixtures/interop/json-forms/',
  import.meta.url
);
for (const name of process.argv.slice(2)) {
  const input = JSON.parse(readFileSync(new URL(name, dir), 'utf8'));
  const { lino, diagnostics } = importJsonForms(input);
  console.log(`== ${name}\n${lino}`);
  console.log(diagnostics.map((d) => `${d.severity} ${d.code}`).join('\n'));
  const parsed = parse(lino, { vocabulary: interopVocabulary() });
  console.log('parse diagnostics', parsed.diagnostics);
  const out = exportJsonForms(lino);
  console.log('export diagnostics', out.diagnostics);
  try {
    deepStrictEqual(normalizeJsonForms(out.json), normalizeJsonForms(input));
    console.log('ROUND TRIP OK');
  } catch {
    console.log('MISMATCH', JSON.stringify(out.json, null, 1));
  }
}
