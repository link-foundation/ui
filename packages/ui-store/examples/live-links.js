import { createStore } from '../src/store.js';
import { bindStoreLinks } from '../src/doublets/bind-links.js';
import { createSyncedLinks } from '../../ui-links/src/client.js';
import { connectWebSocket } from '../../ui-links/src/websocket.js';

const params = new window.URLSearchParams(location.search);
const transport = await connectWebSocket(params.get('server'));
const client = createSyncedLinks({ transport });
await client.subscribe([]);
const store = createStore();
const status = document.querySelector('#status');
const binding = bindStoreLinks(store, client, {
  roots: params.getAll('root').map(Number),
  onError: (error) => {
    status.textContent = error.message;
  },
});
const render = () => {
  document.querySelector('#first').value = store.get('a').positional.join(' ');
  document.querySelector('#second').value = store.get('b').positional.join(' ');
  document.querySelector('#document').textContent = store.toLino();
  document.querySelector('#undo').disabled = !store.canUndo();
};
store.subscribe(render);
for (const [selector, id] of [
  ['#first', 'a'],
  ['#second', 'b'],
]) {
  const input = document.querySelector(selector);
  input.disabled = false;
  input.addEventListener('input', () => store.setPositional(id, [input.value]));
}
document.querySelector('#undo').onclick = () => store.undo();
client.onError((error) => {
  status.textContent = `Server refused edit: ${error.message}`;
});
status.textContent = 'Connected';
render();
window.demo = { client, store, binding, transport };
window.addEventListener(
  'pagehide',
  () => {
    binding();
    client.disconnect();
    transport.close();
  },
  { once: true }
);
