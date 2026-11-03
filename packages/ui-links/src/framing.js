/**
 * The framing of `clink --serve`: a text message is its lines followed by a
 * line holding only `.`, a line starting with `.` getting one more `.`
 * (dot-stuffing); `\r\n` is read as `\n`. A message whose first byte is
 * `0x10`..`0x1F` is a binary Links Notation packet instead, framed by its
 * own length.
 */

import { decodeBinary, isBinary } from './lino.js';
import { LinksError } from './links.js';

/** 64 MiB, the default limit of link-cli's server. */
export const MAX_MESSAGE_BYTES = 64 * 1024 * 1024;

const encoder = new TextEncoder();

/** LiNo text as one framed message. */
export function encodeMessage(text) {
  const lines =
    text === ''
      ? []
      : text
          .split('\n')
          .map((line) => (line.startsWith('.') ? `.${line}` : line));
  return encoder.encode([...lines, '.', ''].join('\n'));
}

/**
 * A reader of framed messages: feed it chunks, it calls `onText(text)` and
 * `onBinary(bytes)` for every message they complete.
 * @param {{ onText: (text: string) => void, onBinary?: (bytes: Uint8Array) => void, maxBytes?: number }} handlers
 */
export function createMessageReader({
  onText,
  onBinary,
  maxBytes = MAX_MESSAGE_BYTES,
}) {
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let buffer = new Uint8Array(0);
  let lines = [];
  let size = 0;
  let mode = null;

  const take = (n) => {
    const out = buffer.subarray(0, n);
    buffer = buffer.subarray(n);
    return out;
  };

  return {
    push(chunk) {
      const joined = new Uint8Array(buffer.length + chunk.length);
      joined.set(buffer);
      joined.set(chunk, buffer.length);
      buffer = joined;
      for (;;) {
        if (buffer.length === 0) {
          return;
        }
        mode ??= isBinary(buffer) ? 'binary' : 'text';
        if (mode === 'binary') {
          if (!onBinary) {
            throw new LinksError(
              'bad-request',
              'Binary messages are not accepted'
            );
          }
          const decoded = decodeBinary(buffer);
          if (decoded === null) {
            if (buffer.length > maxBytes) {
              throw new LinksError(
                'limit',
                `Message longer than ${maxBytes} bytes`
              );
            }
            return;
          }
          mode = null;
          onBinary(take(decoded.size).slice());
          continue;
        }
        const newline = buffer.indexOf(10);
        if (newline === -1) {
          if (size + buffer.length > maxBytes) {
            throw new LinksError(
              'limit',
              `Message longer than ${maxBytes} bytes`
            );
          }
          return;
        }
        let line = decoder.decode(take(newline + 1)).slice(0, -1);
        if (line.endsWith('\r')) {
          line = line.slice(0, -1);
        }
        if (line === '.') {
          const text = lines.join('\n');
          lines = [];
          size = 0;
          mode = null;
          onText(text);
          continue;
        }
        line = line.startsWith('.') ? line.slice(1) : line;
        size += line.length + 1;
        if (size > maxBytes) {
          throw new LinksError(
            'limit',
            `Message longer than ${maxBytes} bytes`
          );
        }
        lines.push(line);
      }
    },
  };
}
