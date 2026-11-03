// Dev mode experiment: the property rows of the sample elements.
import { readFileSync } from 'node:fs';
import { parse } from '@link-foundation/ui-core';
import { createConfig } from '@link-foundation/ui-config';
import { propertyRows } from '../packages/ui-devmode/src/model.js';

const text = readFileSync(
  'docs/case-studies/issue-1/samples/document.lino',
  'utf8'
);
const doc = parse(text);
const config = createConfig({ document: doc });
for (const id of ['app', 'body', 'greeting', 'ok']) {
  for (const r of propertyRows(doc.byId.get(id), config)) {
    console.log(
      id,
      r.label,
      r.name,
      r.key,
      r.type,
      r.editor,
      r.text,
      r.layer,
      r.writable
    );
  }
}
