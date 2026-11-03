// How ui-store reports the state properties that drive animation triggers (#52).
import { createStore } from '@link-foundation/ui-store';
const store = createStore({
  text: "(ok: button (label 'OK') (on pressed (play press-feedback)))\n(b: button)",
});
console.log(store.roots(), store.get(store.roots()[0]));
store.subscribe((events) => console.log(JSON.stringify(events)));
store.setProp('ok', 'pressed', ['true']);
store.setProp('ok', 'pressed', ['false']);
store.removeProp('ok', 'pressed');
