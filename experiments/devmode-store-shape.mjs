// Dev mode experiment: the shape of ui-store views and of config.effective(), which the
// inspector reads (outline, rows, source, styles).
import { readFileSync } from 'node:fs';
import { parse } from '@link-foundation/ui-core';
import { createStore } from '@link-foundation/ui-store';
import { createConfig } from '@link-foundation/ui-config';
const text = readFileSync(
  'docs/case-studies/issue-1/samples/document.lino',
  'utf8'
);
const doc = parse(text);
const store = createStore({ document: doc });
console.log(Object.keys(store));
console.log(JSON.stringify(store.get('ok')), store.parentOf('ok'));
const d = store.toDocument();
console.log(Object.keys(d), d.byId ? 'byId' : 'no byId', d.roots?.[0]?.id);
const config = createConfig({ document: doc });
const eff = config.effective();
console.log(Object.keys(eff), eff.byId?.get?.('ok')?.id);
config.set('session', 'ok', 'label', ['Okay']);
console.log(JSON.stringify(config.effective().byId?.get('ok')?.properties));
