/* global document, window, structuredClone */
import { parse, format } from '@link-foundation/ui-core';
import { loadTheme } from '@link-foundation/ui-themes';
import { mountControls } from '../../packages/ui-components/src/controls/index.js';
const theme = await loadTheme('fluent2');
const controls = parse(await (await fetch('./fluent2-controls.lino')).text())
  .roots[0];
const mounted = new Map();
const diagnostics = [];
for (const id of ['light', 'dark', 'contrast']) {
  const tree = structuredClone(controls);
  const rename = (node) => {
    node.id += `-${id}`;
    node.children.forEach(rename);
  };
  rename(tree);
  const doc = {
    id: `app-${id}`,
    kind: 'document',
    positional: [],
    unknown: [],
    properties: [
      { name: 'theme', values: ['fluent2'] },
      { name: 'scheme', values: [id === 'dark' ? 'dark' : 'light'] },
      { name: 'contrast', values: [id === 'contrast' ? 'more' : 'normal'] },
      { name: 'motion', values: ['system'] },
    ],
    children: [tree],
  };
  mounted.set(
    id,
    mountControls(
      document.getElementById(id),
      format({ roots: [doc], unknown: [] }),
      { themes: [theme], onDiagnostic: (d) => diagnostics.push(d) }
    )
  );
}
window.fluentExample = { mounted, diagnostics };
document.body.dataset.ready = 'true';
