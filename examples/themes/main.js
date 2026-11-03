/* global document, window, localStorage, structuredClone */
import { formatLinks, parse, format } from '@link-foundation/ui-core';
import { loadTheme } from '@link-foundation/ui-themes';
import { mountDocument } from '@link-foundation/ui-dom';
import { CONTROL_KIND_SPECS } from '../../packages/ui-components/src/controls/index.js';

const base = await loadTheme('base');
const controls = parse(await (await fetch('./controls.lino')).text()).roots[0];
const mounted = new Map();
const diagnostics = [];
function panel(id, scheme, contrast = 'normal', nested = false) {
  const child = structuredClone(controls);
  if (nested) {
    child.children = [
      {
        id: 'inside-dark',
        kind: 'stack',
        positional: [],
        unknown: [],
        properties: [{ name: 'scheme', values: ['dark'] }],
        children: [
          ...child.children,
          {
            id: 'dark-label',
            kind: 'text',
            positional: ['Dark inside light'],
            properties: [],
            children: [],
            unknown: [],
          },
          {
            ...structuredClone(controls),
            id: 'inside-light',
            properties: [{ name: 'scheme', values: ['light'] }],
            children: [
              {
                id: 'light-label',
                kind: 'text',
                positional: ['Light again'],
                properties: [],
                children: [],
                unknown: [],
              },
            ],
          },
        ],
      },
    ];
  }
  const renameControls = (node) => {
    if (['button', 'text-field', 'checkbox'].includes(node.kind)) {
      node.id += `-${id}`;
    }
    node.children.forEach(renameControls);
  };
  renameControls(child);
  const inner = format({ roots: [child], unknown: [] });
  const header = formatLinks([
    {
      id: 'app',
      values: [
        'document',
        ['theme', 'base'],
        ['scheme', scheme],
        ['contrast', contrast],
        ['motion', 'system'],
      ],
    },
  ]);
  const text = `${header.trimEnd()}\n${inner
    .trimEnd()
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n')}`;
  const result = mountDocument(document.getElementById(id), text, {
    themes: [base],
    kinds: CONTROL_KIND_SPECS,
    onDiagnostic: (d) => diagnostics.push(d),
  });
  mounted.set(id, result);
}
panel('light', 'light');
panel('dark', 'dark');
panel('nested', 'light', 'normal', true);
panel('contrast', 'light', 'more');
const saved = document.documentElement.dataset.scheme ?? 'system';
panel('system', saved);
const select = document.getElementById('scheme');
select.value = saved;
select.addEventListener('change', () => {
  const result = mounted.get('system');
  result.store.setProp('app', 'scheme', [select.value]);
  result.handle.flush();
  document.documentElement.dataset.scheme = select.value;
  try {
    localStorage.setItem(
      'ui-theme',
      JSON.stringify({ theme: 'base', scheme: select.value })
    );
  } catch {
    /* Storage can be disabled. */
  }
});
document.getElementById('status').textContent =
  'Switching preserves every control';
window.themeExample = { mounted, diagnostics };
document.body.dataset.ready = 'true';
