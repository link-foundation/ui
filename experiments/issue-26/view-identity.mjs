// Which fields of store.get(id) keep their identity across unrelated changes?
// The ui-react hooks memoize on these references (useSyncExternalStore needs
// a cached snapshot), so they must be stable for unchanged elements.
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { createStore } from '@link-foundation/ui-store';

const text = readFileSync(
  new URL(
    '../../docs/case-studies/issue-1/samples/document.lino',
    import.meta.url
  ),
  'utf8'
);
const store = createStore({ text });
const a = store.get('greeting');
store.setProp('ok', 'label', ['Save']);
const b = store.get('greeting');
console.log('same view object:', a === b);
console.log('same properties:', a.properties === b.properties);
console.log('same positional:', a.positional === b.positional);
store.setProp('greeting', 'text', ['Hi']);
const c = store.get('greeting');
console.log(
  'after own change, same properties:',
  b.properties === c.properties
);
console.log(
  'setProp of an undeclared name allowed:',
  c.properties.map((p) => p.name)
);
