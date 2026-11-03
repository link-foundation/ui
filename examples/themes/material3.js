/* global document, window, structuredClone */
import { parse, format } from '@link-foundation/ui-core';
import { loadTheme } from '@link-foundation/ui-themes';
import { mountControls } from '../../packages/ui-components/src/controls/index.js';

const theme = await loadTheme('material3');
const controls = parse(await (await fetch('./material3-controls.lino')).text())
  .roots[0];
const diagnostics = [],
  panels = new Map();
for (const [id, scheme, contrast] of [
  ['light', 'light', 'normal'],
  ['dark', 'dark', 'normal'],
  ['contrast', 'light', 'more'],
]) {
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
      { name: 'theme', values: ['material3'] },
      { name: 'scheme', values: [scheme] },
      { name: 'contrast', values: [contrast] },
      { name: 'motion', values: ['system'] },
    ],
    children: [tree],
  };
  panels.set(
    id,
    mountControls(
      document.getElementById(id),
      format({ roots: [doc], unknown: [] }),
      { themes: [theme], onDiagnostic: (d) => diagnostics.push(d) }
    )
  );
}
window.material3Gallery = { panels, diagnostics };
document.body.dataset.ready = 'true';
