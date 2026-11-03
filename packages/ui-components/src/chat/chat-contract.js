/**
 * Provider-neutral, flat link records. References (chat, sender, message,
 * reply-to and parent) are IDs, never provider identifiers to be interpreted.
 * Applications adapt their transport records at this boundary.
 * @typedef {'chat'|'message'|'participant'|'attachment'|'reaction'|'step'} ChatKind
 * @typedef {{id: string, kind: ChatKind, [field: string]: string|number|boolean}} ChatRecord
 * @typedef {ChatRecord & {chat?: string, sender?: string, time?: string, text?: string}} Message
 * @typedef {ChatRecord & {'can-edit'?: boolean, 'can-react'?: boolean, 'can-reply'?: boolean, 'max-attachments'?: number}} Chat
 */
import { parseLinks, formatLinks } from '@link-foundation/ui-core';

const KINDS = new Set([
  'chat',
  'message',
  'participant',
  'attachment',
  'reaction',
  'step',
]);
const BOOLEAN = new Set([
  'can-edit',
  'can-react',
  'can-reply',
  'outgoing',
  'selected',
  'unread',
  'service',
]);
const NUMBER = new Set(['count', 'size', 'max-attachments', 'pinned']);

function fieldValue(kind, name, value) {
  if ((name === 'unread' && kind === 'chat') || NUMBER.has(name)) {
    const number = Number(value);
    if (value === '' || !Number.isSafeInteger(number) || number < 0) {
      throw new TypeError(`Invalid ${name}`);
    }
    return number;
  }
  if (BOOLEAN.has(name)) {
    if (value !== 'true' && value !== 'false') {
      throw new TypeError(`Invalid ${name}`);
    }
    return value === 'true';
  }
  return value;
}

/** Read LiNo text or ui-core raw links (official links-notation parser). */
export function parseChatData(links) {
  const roots = typeof links === 'string' ? parseLinks(links) : links;
  const seen = new Set();
  return roots.map((link) => {
    if (!link.id || !KINDS.has(link.values?.[0]) || seen.has(link.id)) {
      throw new TypeError('Chat records need unique IDs and a known kind');
    }
    seen.add(link.id);
    const [kind, ...fields] = link.values;
    const record = { id: link.id, kind };
    for (const field of fields) {
      if (
        !Array.isArray(field) ||
        field.length !== 2 ||
        field.some((v) => typeof v !== 'string') ||
        Object.hasOwn(record, field[0])
      ) {
        throw new TypeError('Chat fields must be unique scalar links');
      }
      Object.defineProperty(record, field[0], {
        value: fieldValue(kind, ...field),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    return record;
  });
}

/** Write nested LiNo; validate before returning text to keep the contract strict. */
export function chatDataToLino(data) {
  const links = data.map(({ id, kind, ...fields }) => ({
    id,
    values: [
      kind,
      ...Object.entries(fields).map(([name, value]) => {
        if (!['string', 'number', 'boolean'].includes(typeof value)) {
          throw new TypeError('Chat fields must be scalar');
        }
        return [name, String(value)];
      }),
    ],
  }));
  parseChatData(links);
  return formatLinks(links);
}
