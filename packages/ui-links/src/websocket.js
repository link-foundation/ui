/** Browser-native WebSocket transport; no Node.js dependencies. */
import { decodeBinary, encodeBinary, formatLino, parseLino } from './lino.js';
import { LinksError } from './links.js';

/**
 * Connect using the runtime's global WebSocket (browsers, Node.js, Deno, Bun).
 * Each message is one LiNo document; binary mode uses the official codec.
 * @param {string | URL} url
 * @param {{ binary?: boolean }} [options]
 * @returns {Promise<import('./client.js').Transport & { close: () => Promise<void> }>}
 */
export async function connectWebSocket(url, { binary = false } = {}) {
  const offline = () =>
    new LinksError('offline', 'The WebSocket connection is offline');
  let socket;
  try {
    socket = new globalThis.WebSocket(url);
  } catch {
    throw offline();
  }
  socket.binaryType = 'arraybuffer';
  const waiting = [];
  const listeners = new Set();
  let closed = null;
  const fail = () => {
    closed ??= offline();
    for (const { reject } of waiting.splice(0)) {
      reject(closed);
    }
  };
  const ended = new Promise((resolve) => {
    socket.addEventListener(
      'close',
      () => {
        fail();
        resolve();
      },
      { once: true }
    );
  });
  socket.addEventListener('error', fail);
  socket.addEventListener('message', ({ data }) => {
    let text;
    let document;
    try {
      if (typeof data === 'string') {
        text = data;
        document = parseLino(text);
      } else {
        const bytes = new Uint8Array(data);
        const decoded = decodeBinary(bytes);
        if (!decoded || decoded.size !== bytes.length) {
          throw new Error('Expected exactly one binary packet');
        }
        document = decoded.document;
        text = formatLino(document);
      }
    } catch {
      fail();
      socket.close(3002, 'Invalid Links Notation message');
      return;
    }
    const first = document[0];
    if (first && typeof first !== 'string' && first.id === 'notify') {
      for (const listener of listeners) {
        listener(text);
      }
    } else {
      waiting.shift()?.resolve(text);
    }
  });
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', () => reject(offline()), { once: true });
    socket.addEventListener('close', () => reject(offline()), { once: true });
  });
  return {
    send(text) {
      if (closed || socket.readyState !== 1) {
        return Promise.reject(closed ?? offline());
      }
      // Encode before queueing: a local parse error must not shift replies.
      let message;
      try {
        message = binary ? encodeBinary(parseLino(text)) : text;
      } catch (error) {
        return Promise.reject(error);
      }
      return new Promise((resolve, reject) => {
        waiting.push({ resolve, reject });
        try {
          socket.send(message);
        } catch {
          fail();
          socket.close();
        }
      });
    },
    onPush(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close() {
      fail();
      socket.close();
      return ended;
    },
  };
}
