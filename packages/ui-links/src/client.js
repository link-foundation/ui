/**
 * A synced copy of a links server, the way Meteor's minimongo or
 * deep-foundation's minilinks keep a client cache: the client holds the
 * part of the links it loaded or subscribed to, reads it synchronously, and
 * writes to it at once (optimistically) while the writes go to the server
 * in order. Offline, the writes wait in a queue and go when a transport is
 * connected again.
 *
 * - A link created on the client gets a temporary address (counted down
 *   from the largest address); when the server answers, the link moves to
 *   its real address and every link that used the temporary one follows
 *   (`onRemap`, `resolve`).
 * - A write the server refuses is undone in the cache (origin `rollback`)
 *   and reported to `onError`; the writes after it still go.
 * - Changes other clients make arrive as pushes of the subscriptions.
 *
 * The client has the storage interface itself, so the query engine, the
 * type system and the decorators work on it as on any storage.
 */

import { MAX_ADDRESS } from './constants.js';
import { deleteCascade } from './decorators.js';
import {
  allLinks,
  decorate,
  ensureCreated,
  getLink,
  linkOf,
  LinksError,
  notFound,
} from './links.js';
import { formatLino, group, named, parseLino } from './lino.js';
import { createMemoryLinks } from './memory.js';

/**
 * @typedef {{ id: number, from_id: number, to_id: number }} Link
 * @typedef {{ send: (text: string) => Promise<string>, onPush?: (listener: (text: string) => void) => () => void, close?: () => any }} Transport
 * @typedef {{ before: Link | null, after: Link | null, origin: 'local' | 'remote' | 'rollback' | 'remap' }} SyncedChange
 */

/** A number of a reply, or a `bad-reply` error. */
function numberOf(text) {
  if (typeof text !== 'string' || !/^[0-9]+$/.test(text)) {
    throw new LinksError('bad-reply', `Expected a number, found ${text}`);
  }
  return Number(text);
}

/** `(i: s t)` as a link; `ref` reads an address. */
function linkFromLino(value, ref = numberOf) {
  if (
    typeof value === 'string' ||
    value.id === null ||
    value.values.length !== 2
  ) {
    throw new LinksError(
      'bad-reply',
      `Expected (i: s t), found ${formatLino([value])}`
    );
  }
  return linkOf(ref(value.id), ref(value.values[0]), ref(value.values[1]));
}

/** One side of a change: `()`, `((i: s t))` or `(i: s t)`. */
function sideFromLino(side, ref) {
  if (typeof side !== 'string' && side.id === null) {
    if (side.values.length === 0) {
      return null;
    }
    if (side.values.length === 1) {
      return linkFromLino(side.values[0], ref);
    }
  }
  return linkFromLino(side, ref);
}

/**
 * The changes of a reply document: `(before) (after)` lines.
 * @param {any[]} document  parsed LiNo
 * @param {(text: string) => number} [ref]  reads an address (numbers only
 *   by default)
 * @returns {{ before: Link | null, after: Link | null }[]}
 */
export function changesFromLino(document, ref = numberOf) {
  return document.map((change) => {
    if (typeof change === 'string' || change.values.length !== 2) {
      throw new LinksError(
        'bad-reply',
        `Expected a change, found ${formatLino([change])}`
      );
    }
    return {
      before: sideFromLino(change.values[0], ref),
      after: sideFromLino(change.values[1], ref),
    };
  });
}

/** Throw the error of a reply document, if it is one. */
function checkReply(document) {
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
const restrictionLino = (restriction) =>
  group(
    restriction.map((part) =>
      part === null || part === undefined ? '*' : String(part)
    )
  );

/**
 * A transport to a server in the same process: a session of `server`.
 * @param {ReturnType<typeof import('./server.js').createLinksServer>} server
 * @param {{ subject?: number | null }} [options]
 * @returns {Transport & { session: any }}
 */
export function connectInProcess(server, { subject = null } = {}) {
  const listeners = new Set();
  const session = server.session({
    subject,
    onPush: (document) => {
      const text = formatLino(document);
      for (const listener of listeners) {
        listener(text);
      }
    },
  });
  return {
    session,
    send: (text) => Promise.resolve(session.request(text)),
    onPush(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close: () => session.close(),
  };
}

/** `[name, …]` as one request: `(name: value)` or `(name: (a b …))`. */
const op = (name, ...values) => [
  named(name, values.length === 1 ? values : [group(values)]),
];

/** The addresses of the names in a reply document, asked from the server. */
async function addressesOf(request, document) {
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
 * The writes into the cache that do not go to the server: links the server
 * sent, real addresses for temporary ones, refused writes undone.
 */
function createCacheWriter(cache, emit) {
  /** Temporary address → real address. */
  const real = new Map();
  const resolve = (id) => real.get(id) ?? id;

  const put = (link, origin) => {
    const before = getLink(cache, link.id);
    if (before === null) {
      ensureCreated(cache, link.id);
    }
    cache.update(link.id, link.from_id, link.to_id);
    if (
      before === null ||
      before.from_id !== link.from_id ||
      before.to_id !== link.to_id
    ) {
      emit(before, getLink(cache, link.id), origin);
    }
  };
  const remove = (id, origin) => {
    const before = getLink(cache, id);
    if (before !== null) {
      cache.delete(id);
      emit(before, null, origin);
    }
  };

  return {
    real,
    resolve,
    put,
    /** Apply the changes the server reports. */
    applyRemote(changes) {
      for (const { before, after } of changes) {
        if (after === null) {
          remove(before.id, 'remote');
        } else {
          put(after, 'remote');
        }
      }
    },
    /** Move the link at `temp` to `id`, and every use of `temp` with it. */
    remap(temp, id) {
      real.set(temp, id);
      const link = getLink(cache, temp);
      if (link === null) {
        return;
      }
      const swap = (x) => (x === temp ? id : x);
      if (getLink(cache, id) === null) {
        ensureCreated(cache, id);
      }
      cache.update(id, swap(link.from_id), swap(link.to_id));
      const users = [
        ...allLinks(cache, { from_id: temp }),
        ...allLinks(cache, { to_id: temp }),
      ];
      for (const user of users) {
        const now = getLink(cache, user.id);
        if (now !== null && now.id !== temp) {
          cache.update(now.id, swap(now.from_id), swap(now.to_id));
        }
      }
      cache.delete(temp);
      emit(link, getLink(cache, id), 'remap');
    },
    /** Undo the local changes of a refused write, newest first. */
    undo(changes) {
      for (const change of [...changes].reverse()) {
        const was = change.before;
        if (was === null) {
          remove(resolve(change.after.id), 'rollback');
        } else {
          const at = resolve(was.id);
          put(linkOf(at, resolve(was.from_id), resolve(was.to_id)), 'rollback');
        }
      }
    },
  };
}

/**
 * The writes waiting for the server, sent in order, one at a time.
 * @param {object} io
 * @param {ReturnType<typeof createCacheWriter>} io.writer
 * @param {(document: any[]) => Promise<any[]>} io.request
 * @param {() => boolean} io.connected
 * @param {() => void} io.disconnect  called when the transport fails
 * @param {(error: Error, write: object | null) => void} io.report
 */
function createOutbox({ writer, request, connected, disconnect, report }) {
  const queue = [];
  let flushing = null;
  const { resolve } = writer;

  const sendCreate = async (entry) => {
    const s = String(resolve(entry.source));
    const t = String(resolve(entry.target));
    const self = entry.source === entry.id || entry.target === entry.id;
    const [created] = changesFromLino(
      await request(self ? op('create', '0', '0') : op('create', s, t))
    );
    writer.remap(entry.id, created.after.id);
    if (self) {
      const id = String(created.after.id);
      const swap = (part, text) => (part === entry.id ? id : text);
      await request(
        op('update', id, swap(entry.source, s), swap(entry.target, t))
      );
    }
  };

  /** Send one write; bring its answer into the cache. */
  const send = async (entry) => {
    const id = String(resolve(entry.id));
    if (entry.kind === 'create') {
      await sendCreate(entry);
    } else if (entry.kind === 'update') {
      const s = String(resolve(entry.source));
      const t = String(resolve(entry.target));
      await request(op('update', id, s, t));
    } else {
      writer.applyRemote(changesFromLino(await request(op('delete', id))));
    }
  };

  /** Send one write; `false` when the transport failed. */
  const sendFirst = async () => {
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
    return true;
  };

  const run = async () => {
    // `flush` stores the promise before the loop can end.
    await null;
    try {
      while (queue.length > 0 && connected() && (await sendFirst())) {
        // Every write is sent by the condition.
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
      if (connected()) {
        flush();
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
const withProperties = (target, source) =>
  Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));

/** `add(listener)` → `remove()` over a set of listeners. */
const listenerSet = (set) => (listener) => {
  set.add(listener);
  return () => set.delete(listener);
};

/**
 * A synced copy of the links of a server.
 * @param {{ transport?: Transport | null, cache?: any }} [options]
 *   `transport` connects right away; `cache` is the local storage (memory by
 *   default; a persisted one keeps the copy between sessions)
 */
export function createSyncedLinks({
  transport = null,
  cache = createMemoryLinks(),
} = {}) {
  const listeners = { change: new Set(), error: new Set(), remap: new Set() };
  const call = (kind, ...args) => {
    for (const listener of listeners[kind]) {
      listener(...args);
    }
  };
  const emit = (before, after, origin) =>
    call('change', Object.freeze({ before, after, origin }));
  const writer = createCacheWriter(cache, emit);
  let nextTemp = MAX_ADDRESS;
  let current = null;
  let stopPush = null;

  const isTemporary = (id) => id > nextTemp && !writer.real.has(id);
  const disconnect = () => {
    stopPush?.();
    stopPush = null;
    current = null;
  };
  const request = async (document) => {
    if (current === null) {
      throw new LinksError('offline', 'Not connected');
    }
    return checkReply(parseLino(await current.send(formatLino(document))));
  };
  const outbox = createOutbox({
    writer: {
      ...writer,
      remap(temp, id) {
        writer.remap(temp, id);
        call('remap', temp, id);
      },
    },
    request,
    connected: () => current !== null,
    disconnect,
    report: (error, write) => call('error', error, write),
  });

  const storage = decorate(cache, {
    create() {
      const id = nextTemp--;
      cache.createAt(id);
      const after = getLink(cache, id);
      emit(null, after, 'local');
      const changes = [{ before: null, after }];
      outbox.push({ kind: 'create', id, source: 0, target: 0, changes });
      return id;
    },
    update(id, source, target) {
      const before = getLink(cache, id);
      if (before === null) {
        throw notFound(id);
      }
      cache.update(id, source, target);
      const after = getLink(cache, id);
      emit(before, after, 'local');
      const create = outbox.joinable(id, [source, target], isTemporary);
      if (create) {
        Object.assign(create, { source, target });
        create.changes.push({ before, after });
      } else {
        const changes = [{ before, after }];
        outbox.push({ kind: 'update', id, source, target, changes });
      }
      return id;
    },
    delete(id) {
      const removed = deleteCascade(cache, id);
      for (const link of removed) {
        emit(link, null, 'local');
      }
      const changes = removed.map((before) => ({ before, after: null }));
      outbox.push({ kind: 'delete', id, source: 0, target: 0, changes });
      return id;
    },
  });
  delete storage.createAt;

  const synced = withProperties(storage, {
    cache,
    /** Use `next` as the transport: pushes come in, queued writes go. */
    connect(next) {
      disconnect();
      current = next;
      stopPush =
        next.onPush?.((text) => {
          const [notify, ...changes] = parseLino(text);
          if (typeof notify !== 'string' && notify.id === 'notify') {
            writer.applyRemote(changesFromLino(changes));
          }
        }) ?? null;
      return outbox.flush();
    },
    /** Stop using the transport; writes queue until `connect`. */
    disconnect,
    get connected() {
      return current !== null;
    },
    /** The number of writes the server has not answered yet. */
    get pending() {
      return outbox.size;
    },
    /** Send the queued writes; resolves when they are answered. */
    flush: () => outbox.flush(),
    /** The real address of a temporary one (itself when it is not one). */
    resolve: writer.resolve,
    /** Whether `id` is a temporary address still waiting for the server. */
    isTemporary,
    /** Load the links of a restriction `[index, source, target]` into the cache. */
    async load(restriction = []) {
      const reply = await request(op('each', restrictionLino(restriction)));
      const links = reply.map((value) => linkFromLino(value));
      links.forEach((link) => writer.put(link, 'remote'));
      return links;
    },
    /** Load the links of a restriction and keep them up to date. */
    async subscribe(restriction = []) {
      const [reply] = await request(
        op('subscribe', restrictionLino(restriction))
      );
      const links = await synced.load(restriction);
      return { id: numberOf(reply.values[0]), links };
    },
    /** Stop the pushes of a subscription. */
    async unsubscribe(id) {
      await request(op('unsubscribe', String(id)));
    },
    /**
     * Run a substitution query (LiNo text) on the server after the queued
     * writes; its changes come into the cache and are returned.
     */
    async query(text) {
      await outbox.flush();
      const document = await request(parseLino(text));
      const addresses = await addressesOf(request, document);
      const changes = changesFromLino(
        document,
        (value) => addresses.get(value) ?? numberOf(value)
      );
      writer.applyRemote(changes);
      return changes;
    },
    /** Every change of the cache: `{ before, after, origin }`. */
    onChange: listenerSet(listeners.change),
    /** Refused writes `(error, write)` and transport failures `(error, null)`. */
    onError: listenerSet(listeners.error),
    /** Every temporary address that got its real one: `(temp, id)`. */
    onRemap: listenerSet(listeners.remap),
  });
  if (transport) {
    synced.connect(transport);
  }
  return synced;
}
