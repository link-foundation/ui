// Can ui-config produce a positional value that is a link (not an atom)?
import { createStore } from '@link-foundation/ui-store';
import { createConfig } from '@link-foundation/ui-config';
import { appDocument } from '../packages/ui-config/tests/helpers.js';
const config = createConfig({ document: appDocument() });
const store = createStore({ document: appDocument() });
config.bindStore(store);
for (const attempt of [
  () => config.set('user', 'greeting', 'text', ['x', ['a', 'b']]),
  () =>
    config.loadLayer(
      'session',
      '(o: overrides (layer session) (base app) (set greeting text x (a b)))'
    ),
]) {
  try {
    console.log('ok', attempt());
    console.log(store.get('greeting').positional);
  } catch (e) {
    console.log('threw', e.name, e.code, e.message);
  }
}
