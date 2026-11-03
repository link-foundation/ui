import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { parseMachine } from '../../packages/ui-components/src/behavior/parse-machine.js';
import {
  interpret,
  createManualClock,
} from '../../packages/ui-components/src/behavior/interpret.js';
for (const name of ['toggle', 'disclosure']) {
  const text = readFileSync(
    new URL(
      `../../packages/ui-components/src/behavior/machines/${name}.lino`,
      import.meta.url
    ),
    'utf8'
  );
  const { machine, diagnostics } = parseMachine(text);
  console.log(name, diagnostics, JSON.stringify(machine).slice(0, 300));
}
const t = parseMachine(
  readFileSync(
    'packages/ui-components/src/behavior/machines/toggle.lino',
    'utf8'
  )
).machine;
const s = interpret(t);
s.subscribe((x) => console.log('snap', x.state, x.context));
s.send('toggle');
console.log(s.attrs('root'));
s.send('toggle');
console.log(s.attrs('root'));
const d = parseMachine(
  readFileSync(
    'packages/ui-components/src/behavior/machines/disclosure.lino',
    'utf8'
  )
).machine;
const clock = createManualClock();
const ds = interpret(d, {
  clock,
  onDiagnostic: (x) => console.log('diag', x.code),
  actions: {},
});
ds.use({ focus: (t) => console.log('focus', t) });
ds.send('toggle');
console.log(ds.state, ds.attrs('trigger'), ds.attrs('content'));
ds.send('close');
console.log(ds.state);
clock.advance(499);
console.log(ds.state);
clock.advance(1);
console.log(ds.state, ds.attrs('content'));
