/** Node.js WebSocket server using ws (MIT); separate from browser imports. */
import { WebSocketServer } from 'ws';
import { MAX_MESSAGE_BYTES } from './framing.js';
import { decodeBinary, encodeBinary, formatLino } from './lino.js';

/**
 * Serve one request/reply per WebSocket message, without TCP framing.
 * Replies follow the request's frame type; pushes use the last request's type.
 * @param {ReturnType<typeof import('./server.js').createLinksServer>} server
 * @param {{ port?: number, host?: string, maxMessageBytes?: number, subject?: number | null }} [options]
 */
export async function listenLinksWebSocket(
  server,
  {
    port = 0,
    host = '127.0.0.1',
    maxMessageBytes = MAX_MESSAGE_BYTES,
    subject = null,
  } = {}
) {
  const wss = new WebSocketServer({
    port,
    host,
    maxPayload: maxMessageBytes,
    perMessageDeflate: false,
  });
  const sessions = new Set();
  wss.on('connection', (socket) => {
    let binary = false;
    let binaryOptions;
    const session = server.session({
      subject,
      onPush(document) {
        if (socket.readyState === 1) {
          socket.send(
            binary
              ? encodeBinary(document, binaryOptions)
              : formatLino(document)
          );
        }
      },
    });
    sessions.add(session);
    socket.on('message', (data, isBinary) => {
      if (socket.readyState !== 1) {
        return;
      }
      try {
        binary = isBinary;
        if (binary) {
          const decoded = decodeBinary(data);
          if (!decoded || decoded.size !== data.length) {
            socket.close(1002, 'Expected exactly one binary packet');
            return;
          }
          binaryOptions = decoded.options;
          socket.send(session.requestBinary(data));
        } else {
          socket.send(session.request(data.toString('utf8')));
        }
      } catch {
        socket.close(1002, 'Invalid Links Notation message');
      }
    });
    socket.on('close', () => {
      session.close();
      sessions.delete(session);
    });
    socket.on('error', () => socket.terminate());
  });
  await new Promise((resolve, reject) => {
    wss.once('listening', resolve);
    wss.once('error', reject);
  });
  const { port: boundPort } = wss.address();
  const address = `${host.includes(':') ? `[${host}]` : host}:${boundPort}`;
  return {
    port: boundPort,
    host,
    address,
    url: `ws://${address}`,
    close: () =>
      new Promise((resolve) => {
        for (const session of sessions) {
          session.close();
        }
        sessions.clear();
        for (const socket of wss.clients) {
          socket.terminate();
        }
        wss.close(() => resolve());
      }),
  };
}
