// Round-trip Adaptive Cards samples: node experiments/issue-61/ac-roundtrip.mjs <card.json>...
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { parse, format } from '@link-foundation/ui-core';
import { importAdaptiveCard } from '../../packages/ui-convert/src/interop/adaptive-cards/import.js';
import { exportAdaptiveCard } from '../../packages/ui-convert/src/interop/adaptive-cards/export.js';
import { interopVocabulary } from '../../packages/ui-convert/src/interop/vocabulary.js';

for (const file of process.argv.slice(2)) {
  const json = JSON.parse(readFileSync(file, 'utf8'));
  const { lino, diagnostics } = importAdaptiveCard(json);
  const doc = parse(lino, { vocabulary: interopVocabulary() });
  const again = format(doc, { style: 'indented' });
  const back = exportAdaptiveCard(lino);
  const equal = isDeepStrictEqual(back.json, json);
  console.log(file, {
    equal,
    stable: again === lino,
    importDiags: diagnostics.map((d) => d.code),
    parseDiags: doc.diagnostics.map(
      (d) => `${d.code}:${d.element ?? ''}:${d.property ?? d.head ?? ''}`
    ),
    exportDiags: back.diagnostics.map((d) => d.code),
  });
  if (!equal || process.env.SHOW) {
    console.log(lino);
    console.log(JSON.stringify(back.json, null, 1).slice(0, 3000));
  }
}
