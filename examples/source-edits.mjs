// Edit a UI document in place with @link-foundation/ui-core/source: the
// comments and the layout of the text are kept.
import { applyOpsToSource, setProp } from '@link-foundation/ui-core/source';

const text = `# primary action
(ok: button
  (label 'OK')   # shown on the button
  (variant filled))
`;

console.log(setProp(text, 'ok', 'label', ['Cancel']));

const result = applyOpsToSource(text, [
  { op: 'setProp', id: 'ok', name: 'note', values: ['Why this is red'] },
  { op: 'rename', id: 'ok', to: 'confirm' },
]);
console.log(result.ok);
console.log(result.text);
