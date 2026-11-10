/**
 * What the synced clients share: the wire of a request and a reply, and the
 * writes that wait for the server.
 */

import { LinksError } from './links.js';
import { group, named, parseLino } from './lino.js';

/**
 * Writes an outbox sends between yields to the event loop. A long flush then
 * neither freezes a page nor hides a test timeout behind microtasks.
 */
export const YIELD_EVERY = 32;
const macrotask = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A number of a reply, or a `bad-reply` error. */
export function numberOf(text) {
  if (typeof text !== 'string' || !/^[0-9]+$/.test(text)) {
    throw new LinksError('bad-reply', `Expected a number, found ${text}`);
  }
  return Number(text);
}

/** Throw the error of a reply document, if it is one. */
export function checkReply(document) {
  const [first] = document;
  if (
    document.length === 1 &&
    typeof first !== 'string' &&
    first.id === 'error' &&
    first.values.length === 1
  ) {
    throw new LinksError('remote', String(first.values[0]));
  }
  return document;
}

/** A restriction `[i, s, t]` as `(i s t)`; missing parts are `*`. */
export const restrictionLino = (restriction) =>
  group(
    restriction.map((part) =>
      part === null || part === undefined ? '*' : String(part)
    )
  );

/** `[name, …]` as one request: `(name: value)` or `(name: (a b …))`. */
export const op = (name, ...values) => [
  named(name, values.length === 1 ? values : [group(values)]),
];

/** The addresses of the names in a reply document, asked from the server. */
export async function addressesOf(request, document) {
  const found = new Map();
  const visit = async (value) => {
    if (typeof value === 'string') {
      if (!/^[0-9]+$/.test(value) && !found.has(value)) {
        const [link] = await request(op('get-by-name', value));
        if (!link) {
          throw new LinksError(
            'bad-reply',
            `Unknown name in a reply: ${value}`
          );
        }
        found.set(value, numberOf(link.values[0]));
      }
      return;
    }
    if (value.id !== null) {
      await visit(value.id);
    }
    for (const inner of value.values) {
      await visit(inner);
    }
  };
  for (const value of document) {
    await visit(value);
  }
  return found;
}

/**
 * The writes waiting for the server, sent in order, one at a time.
 * @param {object} io
 * @param {(entry: object) => Promise<void>} io.send  sends one write and
 *   brings its answer into the cache
 * @param {{ undo: (changes: any[]) => void }} io.writer
 * @param {() => boolean} io.connected
 * @param {() => void} io.disconnect  called when the transport fails
 * @param {(error: Error, write: object | null) => void} io.report
 */
export function createOutbox({
  send,
  writer,
  connected,
  disconnect,
  report,
  queue,
  checkpoint,
  durable,
}) {
  let flushing = null;

  /** Send one write; `false` when the transport failed. */
  const sendFirst = async () => {
    await durable();
    const entry = queue[0];
    entry.sent = true;
    try {
      await send(entry);
    } catch (error) {
      if (!(error instanceof LinksError) || error.code === 'offline') {
        // The transport failed: keep the write for the next connection.
        entry.sent = false;
        disconnect();
        report(error, null);
        return false;
      }
      writer.undo(entry.changes);
      report(error, entry);
    }
    queue.shift();
    checkpoint();
    await durable();
    return true;
  };

  const run = async () => {
    // `flush` stores the promise before the loop can end.
    await null;
    try {
      let sent = 0;
      while (queue.length > 0 && connected() && (await sendFirst())) {
        // Every write is sent by the condition. An in-process transport
        // answers in microtasks only: let timers and I/O run now and then.
        if (++sent % YIELD_EVERY === 0) {
          await macrotask();
        }
      }
    } finally {
      // Cleared in the step that saw the queue empty: a write queued later
      // starts a new run.
      flushing = null;
    }
  };

  const flush = () => (flushing ??= run());

  return {
    flush,
    get size() {
      return queue.length;
    },
    /** Queue a write made in the cache. */
    push(entry) {
      queue.push({ sent: false, ...entry });
      checkpoint();
      if (connected()) {
        flush().catch((error) => {
          disconnect();
          report(error, null);
        });
      }
    },
    /** A create not sent yet that an update of `id` can join. */
    joinable(id, parts, isTemporary) {
      if (parts.some((part) => part !== id && isTemporary(part))) {
        return null;
      }
      return (
        queue.find((e) => e.kind === 'create' && e.id === id && !e.sent) ?? null
      );
    },
  };
}

/** `target` with the properties of `source`, getters kept as getters. */
export const withProperties = (target, source) =>
  Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));

/** `add(listener)` → `remove()` over a set of listeners. */
export const listenerSet = (set) => (listener) => {
  set.add(listener);
  return () => set.delete(listener);
};

/** Replay before reading a snapshot; retry if local writes raced with it. */
export async function refreshClient({
  outbox,
  request,
  writer,
  reconcile,
  subscriptions,
  remoteSubscriptions,
  transport,
  checkpoint,
  durable,
  isCurrent,
  getVersion,
  buffer,
  refresh,
}) {
  await outbox.flush();
  if (!refresh) {
    remoteSubscriptions.transport = transport;
    await durable();
    return;
  }
  if (!isCurrent()) {
    return;
  }
  if (remoteSubscriptions.transport === transport) {
    for (const id of remoteSubscriptions.ids.values()) {
      await request(op('unsubscribe', String(id)));
    }
  }
  remoteSubscriptions.transport = transport;
  remoteSubscriptions.ids.clear();
  for (const [id, restriction] of subscriptions) {
    const [reply] = await request(
      op('subscribe', restrictionLino(restriction))
    );
    remoteSubscriptions.ids.set(id, numberOf(reply.values[0]));
  }
  // No server change log: a fresh readable snapshot also removes
  // deleted links and links the subject may no longer read.
  let reply;
  while (isCurrent()) {
    await outbox.flush();
    if (!isCurrent()) {
      return;
    }
    const version = getVersion();
    buffer.value = [];
    reply = await request(op('each', restrictionLino([])));
    if (!isCurrent()) {
      return;
    }
    if (version === getVersion() && outbox.size === 0) {
      break;
    }
  }
  if (!isCurrent()) {
    return;
  }
  reconcile(reply);
  writer.applyRemote(buffer.value);
  buffer.value = null;
  checkpoint();
  await durable();
}

/** Buffer pushes while a reconnect snapshot is being read. */
export function listenForPush(next, writer, buffer, changesOf) {
  return (
    next.onPush?.((text) => {
      const [notify, ...changes] = parseLino(text);
      if (typeof notify !== 'string' && notify.id === 'notify') {
        const parsed = changesOf(changes);
        if (buffer.value) {
          buffer.value.push(...parsed);
        } else {
          writer.applyRemote(parsed);
        }
      }
    }) ?? null
  );
}

/** The listeners of a client, and telling them. */
export function createListeners() {
  const listeners = { change: new Set(), error: new Set(), remap: new Set() };
  const call = (kind, ...args) => {
    for (const listener of listeners[kind]) {
      listener(...args);
    }
  };
  const emit = (before, after, origin) =>
    call('change', Object.freeze({ before, after, origin }));
  return { listeners, call, emit };
}
