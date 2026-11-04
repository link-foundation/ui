import { describe, it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { WebSocketServer } from 'ws';
import {
  allLinks,
  createLinksServer,
  createMemoryLinks,
  createSyncedLinks,
  decodeBinary,
  encodeBinary,
  parseLino,
} from '@link-foundation/ui-links';
import { connectWebSocket } from '../src/websocket.js';
import { listenLinksWebSocket } from '../src/websocket-server.js';

for (const binary of [false, true]) {
  describe(`WebSocket ${binary ? 'binary' : 'text'}`, () => {
    it('orders replies, separates pushes and synchronises clients', async () => {
      const server = createLinksServer({ links: createMemoryLinks() });
      const listener = await listenLinksWebSocket(server);
      const a = await connectWebSocket(listener.url, { binary });
      const b = await connectWebSocket(listener.url, { binary: !binary });
      try {
        const client = createSyncedLinks({ transport: a });
        await client.subscribe([]);
        const pushed = new Promise((resolve) => a.onPush(resolve));
        const replies = await Promise.all([
          b.send('(create: (0 0))'),
          b.send('(update: (1 1 1))'),
          b.send('(count: ())'),
          b.send('(each: ())'),
        ]);
        assert.deepEqual(replies, [
          '() ((1: 0 0))',
          '((1: 0 0)) ((1: 1 1))',
          '(count: 1)',
          '(1: 1 1)',
        ]);
        assert.equal(parseLino(await pushed)[0].id, 'notify');
        // A reply on the subscriber is a barrier after its pushes.
        assert.equal(await a.send('(count: ())'), '(count: 1)');
        await client.flush();
        assert.deepEqual(allLinks(client), allLinks(server.links));
        const id = client.create();
        client.update(id, 1, id);
        await client.flush();
        assert.equal(client.pending, 0);
        assert.deepEqual(allLinks(client), allLinks(server.links));
        assert.match(await b.send('(create: (999 0))'), /^\(error:/);
        assert.equal(await b.send('(count: ())'), '(count: 2)');
      } finally {
        await a.close();
        await b.close();
        await listener.close();
      }
      assert.equal(server.sessions.length, 0);
    });

    it('sends one native WebSocket message without TCP framing', async () => {
      const server = createLinksServer({ links: createMemoryLinks() });
      const listener = await listenLinksWebSocket(server);
      const socket = new globalThis.WebSocket(listener.url);
      try {
        await new Promise((resolve) =>
          socket.addEventListener('open', resolve, { once: true })
        );
        socket.binaryType = 'arraybuffer';
        const response = new Promise((resolve) =>
          socket.addEventListener('message', resolve, { once: true })
        );
        socket.send(
          binary ? encodeBinary(parseLino('(count: ())')) : '(count: ())'
        );
        const { data } = await response;
        if (binary) {
          assert.ok(data instanceof ArrayBuffer);
          assert.deepEqual(
            decodeBinary(new Uint8Array(data)).document,
            parseLino('(count: 0)')
          );
        } else {
          assert.equal(data, '(count: 0)');
        }
      } finally {
        socket.close();
        await listener.close();
      }
    });
  });
}

describe('WebSocket failures', () => {
  it('rejects all waiting requests as offline and retains the outbox for reconnect', async () => {
    const silent = new WebSocketServer({ port: 0, host: '127.0.0.1' });
    await new Promise((resolve) => silent.once('listening', resolve));
    const transport = await connectWebSocket(
      `ws://127.0.0.1:${silent.address().port}`
    );
    const client = createSyncedLinks({ transport });
    const id = client.create();
    const pending = [
      transport.send('(count: ())'),
      transport.send('(each: ())'),
    ];
    const rejected = pending.map((p) => assert.rejects(p, { code: 'offline' }));
    await transport.close();
    await Promise.all(rejected);
    await client.flush();
    assert.equal(client.pending, 1);
    assert.ok(client.isTemporary(id));
    await assert.rejects(transport.send('()'), { code: 'offline' });
    await new Promise((resolve) => silent.close(resolve));
    const server = createLinksServer({ links: createMemoryLinks() });
    const listener = await listenLinksWebSocket(server);
    const next = await connectWebSocket(listener.url);
    try {
      await client.connect(next);
      await client.flush();
      assert.equal(client.pending, 0);
      assert.deepEqual(allLinks(client), allLinks(server.links));
    } finally {
      await next.close();
      await listener.close();
    }
  });

  it('rejects pending requests when the peer disconnects or sends malformed replies', async () => {
    for (const malformed of [false, true]) {
      const peer = new WebSocketServer({ port: 0, host: '127.0.0.1' });
      await new Promise((resolve) => peer.once('listening', resolve));
      peer.on('connection', (socket) => {
        socket.once('message', () => {
          if (malformed) {
            socket.send(new Uint8Array([0x10]));
          } else {
            socket.terminate();
          }
        });
      });
      const transport = await connectWebSocket(
        `ws://127.0.0.1:${peer.address().port}`
      );
      try {
        await Promise.all([
          assert.rejects(transport.send('()'), { code: 'offline' }),
          assert.rejects(transport.send('()'), { code: 'offline' }),
        ]);
      } finally {
        await transport.close();
        await new Promise((resolve) => peer.close(resolve));
      }
    }
  });

  it('rejects connection errors as offline', async () => {
    const listener = await listenLinksWebSocket(
      createLinksServer({ links: createMemoryLinks() })
    );
    const url = listener.url;
    await listener.close();
    await assert.rejects(connectWebSocket(url), { code: 'offline' });
  });

  it('closes on incomplete or concatenated binary packets and oversized messages', async () => {
    const server = createLinksServer({ links: createMemoryLinks() });
    const listener = await listenLinksWebSocket(server, {
      maxMessageBytes: 32,
    });
    const packet = encodeBinary(parseLino('(create: (0 0))'));
    try {
      for (const data of [
        packet.subarray(0, packet.length - 1),
        new Uint8Array([...packet, ...packet]),
        'x'.repeat(33),
      ]) {
        const socket = new globalThis.WebSocket(listener.url);
        await new Promise((resolve) =>
          socket.addEventListener('open', resolve, { once: true })
        );
        const closed = new Promise((resolve) =>
          socket.addEventListener('close', resolve, { once: true })
        );
        socket.send(data);
        await closed;
      }
      assert.equal(server.links.count(), 0);
    } finally {
      await listener.close();
    }
    assert.equal(server.sessions.length, 0);
  });
});
