// Usage of @link-foundation/ui-store: edit a UI document, listen to the
// change events, undo, and write the operation log as Links Notation.
// Run: node examples/ui-store-basics.mjs
import { createStore, logFromLino, logToLino } from '@link-foundation/ui-store';

const store = createStore({
  text: "(main: stack (ok: button (label 'OK')) (text 'Hello'))",
});

store.subscribe((events, entry) => {
  console.log(`tx ${entry.tx} (${entry.origin}):`);
  for (const e of events) {
    console.log(`  ${e.seq} ${e.type} ${e.id}`, e.before, '->', e.after);
  }
});

console.log(store.children('main')); // ['ok', '_1']

store.transaction(
  'Edit label',
  () => {
    store.setProp('ok', 'label', ['Cancel']);
    store.move('ok', 'main', 1);
  },
  { origin: 'devmode' }
);
console.log(store.toLino());

store.undo();
console.log(store.toLino());

const log = logToLino(store.log());
console.log(log);

// Replaying the log on the original document gives the same document.
const copy = createStore({
  text: "(main: stack (ok: button (label 'OK')) (text 'Hello'))",
});
copy.replay(logFromLino(log));
console.log(copy.toLino() === store.toLino());
