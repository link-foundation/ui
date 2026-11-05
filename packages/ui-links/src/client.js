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

import {
  emptyClientState,
  readClientState,
  writeClientState,
} from './client-state.js';
import {
  addressesOf,
  checkReply,
  createListeners,
  createOutbox,
  listenerSet,
  listenForPush,
  numberOf,
  op,
  refreshClient,
  restrictionLino,
  withProperties,
} from './client-wire.js';
import { persistLinks } from './persist.js';
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
import { formatLino, group, parseLino } from './lino.js';
import { createMemoryLinks } from './memory.js';
import { createLinksNames } from './links-names.js';

/**
 * @typedef {{ id: number, from_id: number, to_id: number }} Link
 * @typedef {{ send: (text: string) => Promise<string>, onPush?: (listener: (text: string) => void) => () => void, close?: () => any }} Transport
 * @typedef {{ before: Link | null, after: Link | null, origin: 'local' | 'remote' | 'rollback' | 'remap' }} SyncedChange
 */

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

/**
 * The writes into the cache that do not go to the server: links the server
 * sent, real addresses for temporary ones, refused writes undone.
 */
function createCacheWriter(cache, emit, remaps) {
  /** Temporary address → real address. */
  const real = new Map(remaps);
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
    remove,
    refreshNames(ids, metadata) {
      for (const mark of createLinksNames(cache).bindings(ids)) {
        remove(mark.id, 'remote');
      }
      metadata.forEach((value) => put(linkFromLino(value), 'remote'));
    },
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

/** How a write of links goes to the server. */
function createLinkSender({ writer, request, durable, remapped }) {
  const { resolve } = writer;

  const sendCreate = async (entry) => {
    const s = String(resolve(entry.source));
    const t = String(resolve(entry.target));
    const self = entry.source === entry.id || entry.target === entry.id;
    let real = resolve(entry.id);
    if (real === entry.id) {
      const [created] = changesFromLino(
        await request(self ? op('create', '0', '0') : op('create', s, t))
      );
      real = created.after.id;
      writer.remap(entry.id, real);
      remapped(entry.id, real);
      await durable();
    }
    if (self) {
      const id = String(real);
      const swap = (part, text) => (part === entry.id ? id : text);
      await request(
        op('update', id, swap(entry.source, s), swap(entry.target, t))
      );
    }
  };

  /** Send one write; bring its answer into the cache. */
  return async (entry) => {
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
}

/** Optimistic writes keep their inverse changes with the durable outbox. */
function createOptimisticStorage(
  cache,
  { allocate, changed, emit, outbox, isTemporary, checkpoint }
) {
  return decorate(cache, {
    create() {
      changed();
      const id = allocate();
      cache.createAt(id);
      const after = getLink(cache, id);
      emit(null, after, 'local');
      const changes = [{ before: null, after }];
      outbox.push({ kind: 'create', id, source: 0, target: 0, changes });
      return id;
    },
    update(id, source, target) {
      changed();
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
        checkpoint();
      } else {
        const changes = [{ before, after }];
        outbox.push({ kind: 'update', id, source, target, changes });
      }
      return id;
    },
    delete(id) {
      changed();
      const removed = deleteCascade(cache, id);
      for (const link of removed) {
        emit(link, null, 'local');
      }
      const changes = removed.map((before) => ({ before, after: null }));
      outbox.push({ kind: 'delete', id, source: 0, target: 0, changes });
      return id;
    },
  });
}

/** A fresh snapshot replaces the cache, as far as it differs. */
function reconcileLinks(cache, writer, reply) {
  const links = reply.map((v) => linkFromLino(v));
  const ids = new Set(links.map((l) => l.id));
  for (const link of allLinks(cache)) {
    if (!ids.has(link.id)) {
      writer.remove(link.id, 'remote');
    }
  }
  links.forEach((link) => writer.put(link, 'remote'));
}

/** Reads, subscriptions and substitution queries use the active connection. */
function createRemoteMethods({
  request,
  outbox,
  writer,
  checkpoint,
  durable,
  subscriptions,
  remoteSubscriptions: { ids: remoteSubscriptions },
  allocateSubscription,
  ready,
  connected,
}) {
  const methods = {
    /** Load the links of a restriction `[index, source, target]` into the cache. */
    async load(restriction = []) {
      await ready();
      return loadLinks(request, writer, restriction);
    },
    /** Load the links of a restriction and keep them up to date. */
    async subscribe(restriction = []) {
      await ready();
      const [reply] = await request(
        op('subscribe', restrictionLino(restriction))
      );
      const links = await methods.load(restriction);
      const id = allocateSubscription();
      subscriptions.set(id, [...restriction]);
      remoteSubscriptions.set(id, numberOf(reply.values[0]));
      checkpoint();
      await durable();
      return { id, links };
    },
    /** Stop the pushes of a subscription. */
    async unsubscribe(id) {
      const remote = remoteSubscriptions.get(id);
      if (remote !== undefined && connected()) {
        await request(op('unsubscribe', String(remote)));
        remoteSubscriptions.delete(id);
      }
      subscriptions.delete(id);
      checkpoint();
      await durable();
    },
    /**
     * Run a substitution query (LiNo text) on the server after the queued
     * writes; its changes come into the cache and are returned.
     */
    async query(text) {
      await ready();
      await outbox.flush();
      const document = await request(parseLino(text));
      const addresses = await addressesOf(request, document);
      const changes = changesFromLino(
        document,
        (value) => addresses.get(value) ?? numberOf(value)
      );
      writer.applyRemote(changes);
      const ids = changes.flatMap(({ after }) =>
        after ? [after.id, after.from_id, after.to_id] : []
      );
      writer.refreshNames(ids, await requestNameLinks(request, ids));
      return changes;
    },
  };
  return methods;
}

/** Optional name encoding extension; older sidecar servers have no encoding. */
async function requestNameLinks(request, ids) {
  try {
    return await request(
      op('name-links', group([...new Set(ids)].map(String)))
    );
  } catch (error) {
    if (error instanceof LinksError && error.code === 'remote') {
      return [];
    }
    throw error;
  }
}

/** Load data and its names, preserving the older `each` protocol as a fallback. */
async function loadLinks(request, writer, restriction) {
  let data;
  let metadata;
  try {
    const [reply, names] = await request(
      op('load', restrictionLino(restriction))
    );
    // A server without this extension may treat it as a substitution query
    // and return an empty successful result (notably a permission-filtered
    // clink session). Only the explicit envelope identifies extension support.
    if (reply?.id !== 'links' || names?.id !== 'names') {
      throw new LinksError('remote', 'The server does not support load');
    }
    data = reply.values[0].values;
    metadata = names.values[0].values;
  } catch (error) {
    if (!(error instanceof LinksError) || error.code !== 'remote') {
      throw error;
    }
    data = await request(op('each', restrictionLino(restriction)));
    metadata = [];
  }
  const links = data.map((value) => linkFromLino(value));
  links.forEach((link) => writer.put(link, 'remote'));
  writer.refreshNames(
    links.flatMap((link) => [link.id, link.from_id, link.to_id]),
    metadata
  );
  return links;
}

/**
 * A synced copy of the links of a server.
 * @param {{ transport?: Transport | null, cache?: any }} [options]
 *   `transport` connects right away; `cache` is the local storage (memory by
 *   default; a persisted one keeps the copy between sessions)
 */
export function createSyncedLinks({
  transport = null,
  cache = createMemoryLinks(),
  state = emptyClientState(),
  saveState = () => {},
  durable = async () => {},
} = {}) {
  const { listeners, call, emit } = createListeners();
  const writer = createCacheWriter(cache, emit, state.real);
  let nextTemp = state.nextTemp;
  const subscriptions = new Map(state.subscriptions);
  const remoteSubscriptions = { ids: new Map(), transport: null };
  let nextSubscription = state.nextSubscription;
  const checkpoint = () =>
    saveState(
      writeClientState({
        nextTemp,
        connected: state.connected,
        real: [...writer.real],
        queue: state.queue,
        subscriptions: [...subscriptions],
        nextSubscription,
      })
    );
  let connecting = null;
  let localVersion = 0;
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
    send: createLinkSender({
      writer,
      request,
      durable,
      remapped(temp, id) {
        checkpoint();
        call('remap', temp, id);
      },
    }),
    writer,
    queue: state.queue,
    checkpoint,
    durable,
    connected: () => current !== null,
    disconnect,
    report: (error, write) => call('error', error, write),
  });

  const storage = createOptimisticStorage(cache, {
    allocate() {
      while (getLink(cache, nextTemp) !== null) {
        nextTemp--;
      }
      return nextTemp--;
    },
    changed: () => localVersion++,
    emit,
    outbox,
    isTemporary,
    checkpoint,
  });
  delete storage.createAt;

  const synced = withProperties(storage, {
    cache,
    names: createLinksNames(storage),
    /** Use `next` as the transport: pushes come in, queued writes go. */
    connect(next) {
      disconnect();
      current = next;
      const refresh = state.connected;
      state.connected = true;
      checkpoint();
      const buffer = { value: null };
      stopPush = listenForPush(next, writer, buffer, changesFromLino);
      const run = () =>
        refreshClient({
          outbox,
          request,
          writer,
          reconcile: (reply) => reconcileLinks(cache, writer, reply),
          subscriptions,
          remoteSubscriptions,
          transport: next,
          checkpoint,
          durable,
          isCurrent: () => current === next,
          getVersion: () => localVersion,
          buffer,
          refresh,
        });
      connecting = run().catch((error) => {
        if (current === next) {
          disconnect();
          connecting = null;
        }
        call('error', error, null);
        throw error;
      });
      return connecting;
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
    async flush() {
      await connecting;
      await outbox.flush();
      await durable();
    },
    /** The real address of a temporary one (itself when it is not one). */
    resolve: writer.resolve,
    /** Whether `id` is a temporary address still waiting for the server. */
    isTemporary,
    ...createRemoteMethods({
      request,
      outbox,
      writer,
      checkpoint,
      durable,
      subscriptions,
      remoteSubscriptions,
      allocateSubscription: () => nextSubscription++,
      ready: () => connecting,
      connected: () => current !== null,
    }),
    /** Every change of the cache: `{ before, after, origin }`. */
    onChange: listenerSet(listeners.change),
    /** Refused writes `(error, write)` and transport failures `(error, null)`. */
    onError: listenerSet(listeners.error),
    /** Every temporary address that got its real one: `(temp, id)`. */
    onRemap: listenerSet(listeners.remap),
  });
  if (transport) {
    synced.connect(transport).catch(() => {});
  }
  return synced;
}

/** Restore the cache and LiNo outbox from one persistence adapter. */
export async function openSyncedLinks({
  adapter,
  transport = null,
  cache = createMemoryLinks(),
}) {
  if (!adapter.loadState || !adapter.saveState) {
    throw new LinksError(
      'bad-request',
      'Sync persistence needs loadState/saveState'
    );
  }
  const persisted = await persistLinks(cache, adapter);
  const state = readClientState(await adapter.loadState());
  const synced = createSyncedLinks({
    cache: persisted,
    state,
    saveState: (text) => adapter.saveState(text),
    durable: () => persisted.flush(),
  });
  if (transport) {
    await synced.connect(transport);
  }
  return synced;
}
