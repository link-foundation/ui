import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { UiView } from '@link-foundation/ui-react';
import { readSchema, defaults } from '@link-foundation/ui-settings';
import {
  createLayoutRunner,
  defineLinksNetwork,
} from '@link-foundation/ui-components/links-view';
import icons from '@link-foundation/ui-components/dist/icons/own.js';
import { mountForeignDevMode } from '@link-foundation/ui-devmode/foreign';

createRoot(globalThis.document.querySelector('#react')).render(
  createElement(UiView, {
    source: "hello: text 'React from installed archives'",
  })
);
const { schema, diagnostics } = readSchema(`settings-schema: schema
  version 1
appearance: section
  label Appearance
blur:
  type range
  default 18
  min 0
  max 40
  section appearance
`);
if (diagnostics.length) {
  throw new Error(JSON.stringify(diagnostics));
}
globalThis.document.querySelector('#settings').textContent =
  `Settings default: ${defaults(schema).blur}`;
globalThis.document.querySelector('#icon').innerHTML = icons.icons.check.body;
const runner = createLayoutRunner();
try {
  const result = await runner.run('consumer', {
    layout: 'circle',
    links: [{ id: 'link', source: 'a', target: 'b' }],
  });
  if (result.positions.size !== 3) {
    throw new Error('Missing worker positions');
  }
  globalThis.document.querySelector('#worker').textContent =
    'Worker positioned 3 vertices';
} finally {
  runner.dispose();
}
defineLinksNetwork();
const network = globalThis.document.createElement('links-network');
network.setAttribute('label', 'Installed network');
network.items = [{ id: 'link', source: 'a', target: 'b' }];
globalThis.document.querySelector('#network').append(network);
await network.ready;
if (network.positions.size !== 3) {
  throw new Error('Network element worker failed');
}
globalThis.document.querySelector('#inspect').onclick = async () => {
  globalThis.inspector = await mountForeignDevMode();
  globalThis.document.querySelector('#status').textContent = 'Inspector open';
};
