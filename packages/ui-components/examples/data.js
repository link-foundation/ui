import { mountBehavior } from '@link-foundation/ui-components/behavior/dom';
import {
  createDataSource,
  dataVocabulary,
} from '@link-foundation/ui-components/data';
import { parseLinks, formatLinks } from '@link-foundation/ui-core';

const text = await (
  await fetch(new URL('./data.lino', import.meta.url))
).text();
const rows = createDataSource(
  Array.from({ length: 100000 }, (_, i) => ({
    id: `item-${i}`,
    label: `Item ${i}`,
  }))
);
const people = createDataSource(
  Array.from({ length: 10000 }, (_, i) => ({
    id: `person-${i}`,
    name: `Person ${String(i).padStart(5, '0')}`,
    age: 18 + (i % 80),
    team: ['Research', 'Design', 'Engineering'][i % 3],
  }))
);
// 1997 leaves + two parent nodes + the lazy root = 2000 initial nodes.
const nodes = createDataSource([
  {
    id: 'project',
    label: 'Project',
    children: [
      {
        id: 'src',
        label: 'Source',
        children: Array.from({ length: 1997 }, (_, i) => ({
          id: `node-${i}`,
          label: `Module ${i}`,
        })),
      },
    ],
  },
  { id: 'lazy', label: 'On demand', hasChildren: true },
]);
const diagnostics = [];
const documents = parseLinks(text);
// Preserve the official parser's roots; each example mounts one named kind.

const handles = [];
for (const [i, id] of ['list', 'tree', 'table'].entries()) {
  const mounted = mountBehavior(
    document.getElementById(id),
    formatLinks([documents[i]]),
    {
      parseOptions: { vocabulary: dataVocabulary() },
      data: {
        sources: { rows, nodes, people },
        templates: { row: (item) => item.label },
        loadChildren: () =>
          Promise.resolve([{ id: 'lazy-child', label: 'Loaded child' }]),
      },
      host: {
        emit: (_event, args) => {
          document.getElementById('action').textContent =
            `Action: ${args.join(' ')}`;
        },
      },
      onDiagnostic: (d) => diagnostics.push(d),
    }
  );
  handles.push(mounted);
}
let batch = 0;
document.getElementById('prepend').addEventListener('click', () => {
  const added = Array.from({ length: 50 }, (_, i) => ({
    id: `prepend-${batch}-${i}`,
    label: `Prepended ${batch * 50 + i}`,
  }));
  batch++;
  rows.set([...added, ...rows.get()]);
});
// Public example controls also let automated tests drive real source updates.
window.dataExample = { rows, nodes, people, handles, diagnostics };
document.body.dataset.ready = 'true';
