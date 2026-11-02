/**
 * The links server over TCP (Node.js `node:net`), framed like
 * `clink --serve`, so `connectTcp` of `@link-foundation/link-cli-client`
 * talks to it; and a client transport that also takes the pushes of
 * subscriptions, for `createSyncedLinks`.
 */

import net from 'node:net';
import {
  encodeMessage,
  createMessageReader,
  MAX_MESSAGE_BYTES,
} from './framing.js';
import { formatLino, named, parseLino } from './lino.js';
import { LinksError } from './links.js';

/**
 * Serve `server` on a TCP port.
 * @param {ReturnType<typeof import('./server.js').createLinksServer>} server
 * @param {{ port?: number, host?: string, maxMessageBytes?: number, subject?: number | null }} [options]
 * @returns {Promise<{ port: number, host: string, address: string, close: () => Promise<void> }>}
 */
export async function listenLinks(
  server,
  {
    port = 0,
    host = '127.0.0.1',
    maxMessageBytes = MAX_MESSAGE_BYTES,
    subject = null,
  } = {}
) {
  const sockets = new Set();
  const tcp = net.createServer((socket) => {
    sockets.add(socket);
    socket.setNoDelay(true);
    const session = server.session({
      subject,
      onPush: (document) => socket.write(encodeMessage(formatLino(document))),
    });
    const reader = createMessageReader({
      maxBytes: maxMessageBytes,
      onText: (text) => socket.write(encodeMessage(session.request(text))),
      onBinary: (bytes) => socket.write(session.requestBinary(bytes)),
    });
    socket.on('data', (chunk) => {
      try {
        reader.push(chunk);
      } catch (error) {
        socket.end(
          encodeMessage(formatLino([named('error', [error.message])]))
        );
      }
    });
    socket.on('close', () => {
      session.close();
      sockets.delete(socket);
    });
    socket.on('error', () => socket.destroy());
  });
  await new Promise((resolve, reject) => {
    tcp.once('error', reject);
    tcp.listen(port, host, resolve);
  });
  const bound = tcp.address();
  return {
    port: bound.port,
    host,
    address: `${host}:${bound.port}`,
    close: () =>
      new Promise((resolve) => {
        for (const socket of sockets) {
          socket.destroy();
        }
        tcp.close(() => resolve());
      }),
  };
}

/** Whether a message is a push: its first link is `(notify: n)`. */
export function isPush(text) {
  const trimmed = text.trimStart();
  if (!trimmed.startsWith('(notify:')) {
    return false;
  }
  const [first] = parseLino(trimmed);
  return typeof first !== 'string' && first.id === 'notify';
}

/**
 * A text transport to a links server that tells pushes from replies:
 * `send(text)` resolves to the reply of that request (replies come in
 * request order), `onPush(listener)` gets every push.
 * @param {string} address  `host:port`
 */
export async function connectLinks(address) {
  const at = address.lastIndexOf(':');
  const host = address.slice(0, at);
  const port = Number(address.slice(at + 1));
  const socket = net.connect({ host, port });
  await new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('error', reject);
  });
  socket.setNoDelay(true);
  const waiting = [];
  const listeners = new Set();
  let closed = null;
  const fail = (error) => {
    closed ??= error;
    for (const { reject } of waiting.splice(0)) {
      reject(closed);
    }
  };
  const reader = createMessageReader({
    onText(text) {
      if (isPush(text)) {
        for (const listener of listeners) {
          listener(text);
        }
        return;
      }
      waiting.shift()?.resolve(text);
    },
  });
  socket.on('data', (chunk) => {
    try {
      reader.push(chunk);
    } catch (error) {
      socket.destroy();
      fail(error);
    }
  });
  socket.on('close', () =>
    fail(new LinksError('closed', 'The connection is closed'))
  );
  socket.on('error', (error) => fail(error));
  return {
    send(text) {
      if (closed) {
        return Promise.reject(closed);
      }
      return new Promise((resolve, reject) => {
        waiting.push({ resolve, reject });
        socket.write(encodeMessage(text));
      });
    },
    onPush(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close() {
      return new Promise((resolve) => {
        socket.end(resolve);
        fail(new LinksError('closed', 'The connection is closed'));
      });
    },
  };
}
