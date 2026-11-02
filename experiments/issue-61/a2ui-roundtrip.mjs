// Round trip every A2UI fixture: import, LiNo stability, export vs
// normalised input, and incremental diffs vs the whole import.
import { readFileSync, readdirSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { URL } from 'node:url';
import { format, parse } from '@link-foundation/ui-core';
import {
  A2uiStream,
  applyA2uiDiffs,
  exportA2ui,
  importA2ui,
  normalizeA2ui,
} from '../../packages/ui-convert/src/interop/a2ui/index.js';
import { interopVocabulary } from '../../packages/ui-convert/src/interop/vocabulary.js';

const dir = new URL(
  '../../packages/ui-convert/tests/fixtures/interop/a2ui/',
  import.meta.url
);
const only = process.argv[2];
for (const name of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  if (only && !name.includes(only)) {
    continue;
  }
  const input = JSON.parse(readFileSync(new URL(name, dir), 'utf8'));
  const imported = importA2ui(input);
  const doc = parse(imported.lino, { vocabulary: interopVocabulary() });
  const again = format(doc, { style: 'indented' });
  const exported = exportA2ui(imported.lino);
  const stream = new A2uiStream();
  let tree = [];
  let incremental = true;
  input.messages.forEach((m, i) => {
    tree = applyA2uiDiffs(tree, stream.push(m).diffs);
    const whole = importA2ui(input.messages.slice(0, i + 1)).roots;
    if (!isDeepStrictEqual(tree, whole)) {
      incremental = false;
    }
  });
  const ok = isDeepStrictEqual(exported.json, normalizeA2ui(input));
  console.log(
    name,
    ok ? 'ROUND TRIP OK' : 'ROUND TRIP FAIL',
    again === imported.lino ? 'STABLE' : 'UNSTABLE',
    incremental ? 'INCREMENTAL OK' : 'INCREMENTAL FAIL',
    'parse diags',
    doc.diagnostics.length
  );
  if (only) {
    console.log(imported.lino);
    console.log(JSON.stringify(imported.diagnostics, null, 1));
    console.log(JSON.stringify(doc.diagnostics, null, 1));
    if (!ok) {
      console.log(JSON.stringify(exported.json));
      console.log(JSON.stringify(normalizeA2ui(input)));
    }
  }
}
