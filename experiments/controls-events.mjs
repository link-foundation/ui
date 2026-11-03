// Probe: the actions, emits, changes and store transactions of a few controls.
import {
  mountDoc,
  typeInto,
  commit,
  press,
  microtasks,
} from '../packages/ui-components/tests/support/controls.js';
const t =
  mountDoc(`  (b: button 'Save' (on press (emit saved)) (on click (emit clicked)))
  (n: text-field (label 'Name') (value Ada) (on change (emit renamed)))
  (sw: switch (label 'Wi-Fi') (on change (emit toggled)))
  (lk: link 'Docs' (href '#n'))
  (bad: link 'Bad' (href 'javascript:alert(1)'))`);
console.log('diag', t.codes());
t.part('b', 'root').click();
const input = t.part('n', 'input');
input.focus();
typeInto(input, 'Grace');
commit(input);
const sw = t.part('sw', 'input');
press(sw, ' ');
press(sw, 'Enter');
await microtasks();
console.log('actions', t.actions);
console.log('emitted', t.emitted);
console.log('changes', t.changes);
console.log(
  'tx',
  t.transactions.length,
  t.transactions.map((e) => e.map((x) => x.type))
);
console.log('sw', sw.getAttribute('aria-checked'), t.prop('sw', 'checked'));
const nav = [];
t.container.addEventListener('ui-navigate', (e) => nav.push(e.detail));
t.node('bad').querySelector('a').click();
t.node('lk').querySelector('a').click();
console.log('nav', nav);
