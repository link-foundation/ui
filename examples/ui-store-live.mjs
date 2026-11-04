import { URLSearchParams } from 'node:url';
// Run: node examples/ui-store-live.mjs, then open the printed URL twice.
import {
  createLinksServer,
  createLinksNames,
  createMemoryLinks,
} from '@link-foundation/ui-links';
import { listenLinksWebSocket } from '@link-foundation/ui-links/websocket-server';
import {
  createStore,
  encodeDocument,
  writeDocumentLinks,
} from '@link-foundation/ui-store';
import { defaultMounts } from '../scripts/serve-static.mjs';
import { startStaticServer } from '../scripts/lib/static-server.mjs';

const links = createMemoryLinks();
const store = createStore({
  text: 'app: column\n  a: text First\n  b: text Second',
});
const { roots } = writeDocumentLinks(
  encodeDocument(store.toDocument()),
  links,
  createLinksNames(links)
);
const websocket = await listenLinksWebSocket(
  createLinksServer({ links, names: createLinksNames(links) })
);
const http = await startStaticServer({
  mounts: defaultMounts(process.cwd()),
  port: 4173,
  host: '127.0.0.1',
});
const params = new URLSearchParams({ server: websocket.url });
roots.forEach((id) => params.append('root', String(id)));
console.log(`${http.url}packages/ui-store/examples/live-links.html?${params}`);
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => {
    await websocket.close();
    await http.close();
  });
}
