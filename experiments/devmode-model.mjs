// Issue #54: property rows and edits of the sample document.
import { readFileSync } from 'node:fs';
import { parse } from '@link-foundation/ui-core';
import { createConfig } from '@link-foundation/ui-config';
import { propertyRows, applyEdit, saveSession, resetProperty } from '../packages/ui-devmode/src/model.js';
import { parseDevModePolicy } from '../packages/ui-devmode/src/policy.js';
const doc = parse(readFileSync('docs/case-studies/issue-1/samples/document.lino', 'utf8'));
const config = createConfig({ document: doc });
console.log(Object.keys(config), typeof config.document, config.document?.byId?.size);
const policy = parseDevModePolicy('(p: dev-mode (locked-elements payment-form))');
for (const id of ['app', 'body', 'greeting', 'ok']) {
  console.log(id, propertyRows(doc.byId.get(id), config, { policy }).map((r) => `${r.name}=${r.text}@${r.layer}[${r.editor}]${r.writable ? '' : '!'}`).join(' | '));
}
applyEdit(config, { id: 'ok', name: 'label', value: 'Okay' }, { policy, document: doc });
console.log(config.resolve('ok', 'label'));
saveSession(config, { policy, document: doc });
console.log(config.resolve('ok', 'label'));
resetProperty(config, { id: 'ok', name: 'label' }, { policy, document: doc });
console.log(config.resolve('ok', 'label'));
for (const e of [{ id: 'ok', name: 'label', value: 'x', layer: 'site' }, { id: 'body', name: 'gap', value: '16' }, { id: 'ok', name: 'on', value: 'x' }]) {
  try { applyEdit(config, e, { policy, document: doc }); console.log('ok?', e); } catch (err) { console.log(err.code, err.message); }
}
