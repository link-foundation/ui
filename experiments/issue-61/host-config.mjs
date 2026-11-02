// Convert a host config to a theme and check it parses: node experiments/issue-61/host-config.mjs <hostconfig.json>
import { readFileSync } from 'node:fs';
import { parse, format, defaultVocabulary } from '@link-foundation/ui-core';
import { hostConfigToThemeDetails } from '../../packages/ui-convert/src/interop/adaptive-cards/host-config.js';
import { interopVocabulary } from '../../packages/ui-convert/src/interop/vocabulary.js';

const { lino, unmapped } = hostConfigToThemeDetails(
  JSON.parse(readFileSync(process.argv[2], 'utf8'))
);
console.log(lino.slice(0, 2500));
console.log('unmapped', unmapped.length);
const doc = parse(lino, { vocabulary: interopVocabulary() });
console.log('interop diagnostics', doc.diagnostics);
console.log(
  'default diagnostics',
  parse(lino, { vocabulary: defaultVocabulary() }).diagnostics.map(
    (d) => d.code
  )
);
console.log(format(doc, { style: 'indented' }).slice(0, 600));
