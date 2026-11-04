// Run beside `node scripts/serve-static.mjs --port 4173` for browser checks.
import {
  createLinksServer,
  createMemoryLinks,
} from '@link-foundation/ui-links';
import { listenLinksWebSocket } from '@link-foundation/ui-links/websocket-server';

const listener = await listenLinksWebSocket(
  createLinksServer({ links: createMemoryLinks() })
);
console.log(
  `http://127.0.0.1:4173/tests/ui/pages/links-websocket.html?server=${encodeURIComponent(listener.url)}`
);
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => listener.close());
}
