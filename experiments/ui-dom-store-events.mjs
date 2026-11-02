// Probe: the store events the DOM patcher consumes (setProp on a positional
// name, removeProp, subtree insert, move, rename, remove).
import { readFileSync } from 'node:fs';
import { createStore } from '@link-foundation/ui-store';
const text = readFileSync(
  'docs/case-studies/issue-1/samples/document.lino',
  'utf8'
);
const s = createStore({ text });
s.subscribe((events) => console.log(JSON.stringify(events)));
s.setProp('greeting', 'value', ['Hi']);
console.log(JSON.stringify(s.get('greeting')));
s.undo();
s.insert('body', 0, {
  kind: 'stack',
  children: [{ kind: 'text', positional: ['a'] }],
});
s.move('ok', 'body', 0);
s.rename('greeting', 'hello');
s.remove('body');
