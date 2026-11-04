// Manual browser verification: node experiments/issue-110/serve.mjs
import {
  createLinksServer,
  createMemoryLinks,
} from '@link-foundation/ui-links';
import { listenLinksWebSocket } from '@link-foundation/ui-links/websocket-server';
import { defaultMounts } from '../../scripts/serve-static.mjs';
import { startStaticServer } from '../../scripts/lib/static-server.mjs';

const listener = await listenLinksWebSocket(
  createLinksServer({ links: createMemoryLinks() }),
  { port: 4180 }
);
const web = await startStaticServer({
  mounts: defaultMounts(process.cwd()),
  port: 4174,
  host: '127.0.0.1',
});
console.log(
  `${web.url}tests/ui/pages/links-websocket.html?server=${encodeURIComponent(listener.url)}&binary=true`
);
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, async () => {
    await listener.close();
    await web.close();
  });
}
