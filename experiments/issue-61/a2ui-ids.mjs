// Check that ui-core reads A2UI-style ids and nested (bind ...) values.
import {
  readLino,
  writeLino,
  element,
  prop,
} from '../../packages/ui-convert/src/interop/lino.js';

const tree = [
  element('s', 'document', {
    properties: [prop('source', 'a2ui', 'v0.9')],
    children: [
      element('left_text', 'text', {
        positional: ['Hi'],
        properties: [prop('label', ['bind', '/x'])],
      }),
      element('a.b', 'text', { properties: [prop('bind', 'name')] }),
      element('x:y', 'text', { positional: ['q'] }),
    ],
  }),
];
const text = writeLino(tree);
console.log(text);
const back = readLino(text);
console.log(
  JSON.stringify(
    back.roots[0].children.map((c) => [
      c.id,
      c.kind,
      c.positional,
      c.properties,
    ])
  ),
  back.diagnostics
);
