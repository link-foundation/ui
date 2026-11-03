// Dev mode experiment: the inspector layout parses with the inspector vocabulary and no diagnostics.
import { readFileSync } from 'node:fs';
import { parse } from '@link-foundation/ui-core';
import { LAYOUT_VOCABULARY } from '../packages/ui-devmode/src/inspector.js';
const doc = parse(
  readFileSync('packages/ui-devmode/src/inspector.lino', 'utf8'),
  { vocabulary: LAYOUT_VOCABULARY }
);
console.log(doc.diagnostics, JSON.stringify(doc.roots[0].children[1]));
