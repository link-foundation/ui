// WebSocket twin of ui-links-tcp.mjs. Node.js, Deno and Bun can run it.
// Run: node examples/ui-links-websocket.mjs
import assert from 'node:assert/strict';
import {
  createLinksServer,
  createMemoryLinks,
  createSyncedLinks,
  linksToLino,
} from '@link-foundation/ui-links';
import { connectWebSocket } from '@link-foundation/ui-links/websocket';
import { listenLinksWebSocket } from '@link-foundation/ui-links/websocket-server';

export async function runWebSocketExample() {
  const server = createLinksServer({ links: createMemoryLinks() });
  const listener = await listenLinksWebSocket(server);
  const text = await connectWebSocket(listener.url);
  const binary = await connectWebSocket(listener.url, { binary: true });
  const synced = createSyncedLinks({ transport: binary });
  try {
    await synced.subscribe([]);
    const changed = new Promise((resolve) => binary.onPush(resolve));
    await text.send('(create: (0 0))');
    await changed;
    await text.send('(update: (1 1 1))');
    await binary.send('(count: ())');
    await synced.flush();
    assert.equal(linksToLino(synced), '(1: 1 1)');
    const x = synced.create();
    synced.update(x, 1, x);
    await synced.flush();
    assert.equal(await text.send('(each: ())'), linksToLino(synced));
    await synced.query('((1: 1 1)) ((1: 1 2))');
    assert.equal(linksToLino(synced), linksToLino(server.links));
    return linksToLino(synced);
  } finally {
    await text.close();
    await binary.close();
    await listener.close();
  }
}

console.log(await runWebSocketExample());
