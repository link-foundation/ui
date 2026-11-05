/**
 * A synced copy of the triplets of a server in triplet mode
 * (`createLinksServer({ triplets: true })`, `clink --serve --triplets`).
 *
 * Like the synced client of links: reads answer from the cache, and writes
 * apply to it at once and go to the server one at a time. A new triplet has a
 * temporary address, counted down from the largest, until the server gives it
 * a real one. A refused write is undone, and told to `onError`; so is a later
 * write that uses a triplet whose create was refused. Writes made
 * without a connection wait for the next one; that connection reads every
 * readable triplet again.
 *
 * Its `create`, `update`, `delete`, `count` and `each` read and write triplets.
 * It holds no doublets: the server never shows those that store a triplet.
 */

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
import { MAX_ADDRESS } from './constants.js';
import { BREAK, CONTINUE, LinksError } from './links.js';
import { formatLino, parseLino } from './lino.js';
import { cascadeOf, matchesTriplet } from './triplets.js';

const expected = (shape, value) =>
  new LinksError(
    'bad-reply',
    `Expected ${shape}, found ${formatLino([value])}`
  );

/** `(i: T f t)` as a triplet; `ref` reads a reference. */
function tripletFromLino(value, ref) {
  if (typeof value === 'string' || value.values.length !== 3) {
    throw expected('(i: T f t)', value);
  }
  const [type, from, to] = value.values.map(ref);
  return { index: ref(value.id), type, from, to };
}

/** `()` or `((i: T f t))` as a triplet or `null`. */
function sideFromLino(value, ref) {
  if (typeof value === 'string' || value.id !== null) {
    throw expected('a side of a change', value);
  }
  return value.values.length === 0
    ? null
    : tripletFromLino(value.values[0], ref);
}

/** The lines `((i: T f t)) ((i: T f t))` of a reply as changes. */
function tripletChanges(document, ref = numberOf) {
  return document.map((change) => {
    if (typeof change === 'string' || change.values.length !== 2) {
      throw expected('a change', change);
    }
    return {
      before: sideFromLino(change.values[0], ref),
      after: sideFromLino(change.values[1], ref),
    };
  });
}

const sameTriplet = (a, b) =>
  a.type === b.type && a.from === b.from && a.to === b.to;

/** The triplets of `map` that satisfy `query`, by address. */
const eachIn = (map, query) =>
  [...map.values()]
    .filter((triplet) => matchesTriplet(triplet, query))
    .sort((a, b) => a.index - b.index);

/**
 * What the client knows, in two layers: `base` is what the server has said,
 * and `cache`, what reads see, is `base` with the writes still queued replayed
 * on it. An answer of the server changes `base` and replays the rest, so a
 * refused write only has to leave the queue: nothing keeps a value from before
 * it that could have gone stale.
 */
function createTripletCache(emit, queue) {
  const cache = new Map();
  const base = new Map();
  const real = new Map();
  const refused = new Set();
  const resolve = (index) => real.get(index) ?? index;
  const open = (entry) => !entry.done;

  const put = (triplet, origin) => {
    const before = cache.get(triplet.index) ?? null;
    if (before === null || !sameTriplet(before, triplet)) {
      cache.set(triplet.index, triplet);
      emit(before, triplet, origin);
    }
  };
  const remove = (index, origin) => {
    const before = cache.get(index);
    if (before !== undefined) {
      cache.delete(index);
      emit(before, null, origin);
    }
  };

  const replay = (map, entry) => {
    const index = resolve(entry.index);
    if (entry.kind === 'delete') {
      const first = map.get(index);
      if (first !== undefined) {
        const reads = { eachTriplet: (query) => eachIn(map, query) };
        cascadeOf(reads, first).forEach((t) => map.delete(t.index));
      }
    } else if (
      (entry.kind === 'create' || map.has(index)) &&
      ![entry.type, entry.from, entry.to].some((part) => refused.has(part))
    ) {
      map.set(index, {
        index,
        type: entry.point ? index : resolve(entry.type),
        from: resolve(entry.from),
        to: resolve(entry.to),
      });
    }
  };
  const settle = (origin) => {
    const next = new Map(base);
    queue.filter(open).forEach((entry) => replay(next, entry));
    for (const index of [...cache.keys()]) {
      if (!next.has(index)) {
        remove(index, origin);
      }
    }
    next.forEach((triplet) => put(triplet, origin));
  };
  /** Bring changes into `base`; `applies` may leave one out. */
  const learn = (changes, applies = () => true) => {
    const direct = !queue.some(open);
    for (const change of changes.filter(applies)) {
      const { before, after } = change;
      if (after === null) {
        base.delete(before.index);
      } else {
        base.set(after.index, after);
      }
      if (direct && after === null) {
        remove(before.index, 'remote');
      } else if (direct) {
        put(after, 'remote');
      }
    }
    if (!direct) {
      settle('remote');
    }
  };

  return {
    cache,
    real,
    refused,
    resolve,
    /** Changes the server answered to this client: they are simply so. */
    learn,
    /**
     * Changes pushed to a subscription. One that says a triplet left it says
     * nothing of the triplet once `base` holds another value of it: a wider
     * subscription has told where it went.
     */
    applyRemote(changes) {
      learn(changes, ({ before, after }) => {
        const known = base.get(before?.index);
        return (
          after !== null || known === undefined || sameTriplet(known, before)
        );
      });
    },
    /** A snapshot of everything readable, taken with nothing queued. */
    replaceBase(triplets) {
      base.clear();
      triplets.forEach((triplet) => base.set(triplet.index, triplet));
      settle('remote');
    },
    /** The server's answer to a create: `temp` is `created.index` from now on. */
    remap(temp, created) {
      const { index } = created;
      real.set(temp, index);
      base.set(index, created);
      const swap = (part) => (part === temp ? index : part);
      for (const triplet of [...cache.values()]) {
        const moved = {
          index: swap(triplet.index),
          type: swap(triplet.type),
          from: swap(triplet.from),
          to: swap(triplet.to),
        };
        if (moved.index !== triplet.index || !sameTriplet(moved, triplet)) {
          cache.delete(triplet.index);
          cache.set(moved.index, moved);
          emit(triplet, moved, 'remap');
        }
      }
      settle('remote');
    },
    /** The write the server has answered no longer replays. */
    settled(entry) {
      entry.done = true;
    },
    /** A refused write leaves what reads see, and takes its users with it. */
    undo(changes) {
      const entry = queue.find((queued) => queued.changes === changes);
      entry.done = true;
      if (entry.kind === 'create') {
        refused.add(entry.index);
      }
      settle('rollback');
    },
  };
}

/** How a write of triplets goes to the server. */
function createTripletSender({ writer, request, remapped }) {
  const { resolve, refused } = writer;
  const parts = (entry) =>
    [entry.type, entry.from, entry.to].map((part) => String(resolve(part)));
  const ask = async (entry, document) => {
    const reply = await request(document);
    writer.settled(entry);
    return tripletChanges(reply);
  };

  return async (entry) => {
    const lost = [entry.index, entry.type, entry.from, entry.to].find((part) =>
      refused.has(part)
    );
    if (lost !== undefined) {
      throw new LinksError(
        'bad-request',
        `The write that created ${lost} was refused.`
      );
    }
    const index = String(resolve(entry.index));
    const sent = entry.point ? ['0', '0', '0'] : parts(entry);
    if (entry.kind === 'create') {
      const [created] = await ask(entry, op('create', ...sent));
      writer.remap(entry.index, created.after);
      remapped(entry.index, created.after.index);
    } else if (entry.kind === 'update') {
      writer.learn(await ask(entry, op('update', index, ...sent)));
    } else {
      writer.learn(await ask(entry, op('delete', index)));
    }
  };
}

/** Reads and optimistic writes over the cache. */
function createTripletOperations({ writer, outbox, allocate, changed, emit }) {
  const { cache, resolve } = writer;
  const notATriplet = (index) =>
    new LinksError('bad-request', `Link ${index} is not a triplet.`);
  const getTriplet = (index) => cache.get(resolve(index)) ?? null;
  const resolved = (query) => {
    if (query === undefined || query === null) {
      return query;
    }
    if (Array.isArray(query)) {
      return query.map(resolve);
    }
    const { index, type, from, to } = query;
    return {
      index: resolve(index),
      type: resolve(type),
      from: resolve(from),
      to: resolve(to),
    };
  };
  const eachTriplet = (query) => eachIn(cache, resolved(query));

  const insert = (entry) => {
    changed();
    const index = allocate();
    const after = {
      index,
      type: entry.point ? index : resolve(entry.type),
      from: resolve(entry.from),
      to: resolve(entry.to),
    };
    cache.set(index, after);
    emit(null, after, 'local');
    outbox.push({
      kind: 'create',
      ...entry,
      index,
      changes: [{ before: null, after }],
    });
    return index;
  };
  const createTripletPoint = () =>
    insert({ point: true, type: 0, from: 0, to: 0 });
  const createTriplet = (type = 0, from = 0, to = 0) =>
    type === 0 && from === 0 && to === 0
      ? createTripletPoint()
      : insert({ point: false, type, from, to });
  const updateTriplet = (at, type, from, to) => {
    const index = resolve(at);
    const before = cache.get(index);
    if (before === undefined) {
      throw notATriplet(index);
    }
    changed();
    const after = {
      index,
      type: resolve(type),
      from: resolve(from),
      to: resolve(to),
    };
    cache.set(index, after);
    emit(before, after, 'local');
    const changes = [{ before, after }];
    outbox.push({ kind: 'update', index, type, from, to, changes });
    return before;
  };
  const deleteTriplet = (at) => {
    const index = resolve(at);
    const first = cache.get(index);
    if (first === undefined) {
      throw notATriplet(index);
    }
    changed();
    const removed = cascadeOf({ eachTriplet }, first);
    for (const triplet of removed) {
      cache.delete(triplet.index);
      emit(triplet, null, 'local');
    }
    const changes = removed.map((before) => ({ before, after: null }));
    outbox.push({ kind: 'delete', index, changes });
    return removed;
  };

  return {
    getTriplet,
    isTriplet: (index) => getTriplet(index) !== null,
    eachTriplet,
    countTriplets: (query) => eachTriplet(query).length,
    createTriplet,
    createTripletPoint,
    updateTriplet,
    deleteTriplet,
    create: createTriplet,
    update(index, type, from, to) {
      updateTriplet(index, type, from, to);
      return resolve(index);
    },
    delete(index) {
      deleteTriplet(index);
      return resolve(index);
    },
    count: (query) => eachTriplet(query).length,
    each(handler, query) {
      for (const triplet of eachTriplet(query)) {
        if (handler(triplet) === BREAK) {
          return BREAK;
        }
      }
      return CONTINUE;
    },
  };
}

/** Reads, subscriptions and substitution queries over the connection. */
function createRemoteTriplets({
  request,
  writer,
  outbox,
  subscriptions,
  remoteSubscriptions,
  allocateSubscription,
  ready,
  connected,
}) {
  const methods = {
    /** Load the triplets of a restriction `[index, type, from, to]`. */
    async load(restriction = []) {
      await ready();
      const reply = await request(op('each', restrictionLino(restriction)));
      const triplets = reply.map((line) => tripletFromLino(line, numberOf));
      writer.learn(triplets.map((after) => ({ before: null, after })));
      return triplets;
    },
    /** How many triplets of a restriction the server has. */
    async remoteCount(restriction = []) {
      await ready();
      const [reply] = await request(op('count', restrictionLino(restriction)));
      return numberOf(reply.values[0]);
    },
    /** Load the triplets of a restriction and keep them up to date. */
    async subscribe(restriction = []) {
      await ready();
      const [reply] = await request(
        op('subscribe', restrictionLino(restriction))
      );
      const triplets = await methods.load(restriction);
      const id = allocateSubscription();
      subscriptions.set(id, [...restriction]);
      remoteSubscriptions.ids.set(id, numberOf(reply.values[0]));
      return { id, triplets };
    },
    /** Stop the pushes of a subscription. */
    async unsubscribe(id) {
      const remote = remoteSubscriptions.ids.get(id);
      if (remote !== undefined && connected()) {
        await request(op('unsubscribe', String(remote)));
        remoteSubscriptions.ids.delete(id);
      }
      subscriptions.delete(id);
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
      const changes = tripletChanges(
        document,
        (value) => addresses.get(value) ?? numberOf(value)
      );
      writer.learn(changes);
      return changes;
    },
  };
  return methods;
}

/**
 * A synced copy of the triplets of a server.
 * @param {{ transport?: import('./client.js').Transport | null }} [options]
 *   `transport` connects right away
 */
export function createSyncedTriplets({ transport = null } = {}) {
  const { listeners, call, emit } = createListeners();
  const queue = [];
  const writer = createTripletCache(emit, queue);
  const subscriptions = new Map();
  const remoteSubscriptions = { ids: new Map(), transport: null };
  const nothing = () => {};
  const persisted = async () => {};
  let nextTemp = MAX_ADDRESS;
  let nextSubscription = 1;
  let wasConnected = false;
  let connecting = null;
  let localVersion = 0;
  let current = null;
  let stopPush = null;

  const isTemporary = (index) =>
    index > nextTemp && !writer.real.has(index) && !writer.refused.has(index);
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
    send: createTripletSender({
      writer,
      request,
      remapped: (temp, index) => call('remap', temp, index),
    }),
    writer,
    queue,
    checkpoint: nothing,
    durable: persisted,
    connected: () => current !== null,
    disconnect,
    report: (error, write) => call('error', error, write),
  });
  const reconcile = (reply) =>
    writer.replaceBase(reply.map((line) => tripletFromLino(line, numberOf)));

  const synced = withProperties(
    createTripletOperations({
      writer,
      outbox,
      allocate: () => nextTemp--,
      changed: () => localVersion++,
      emit,
    }),
    {
      /** Use `next` as the transport: pushes come in, queued writes go. */
      connect(next) {
        disconnect();
        current = next;
        const refresh = wasConnected;
        wasConnected = true;
        const buffer = { value: null };
        stopPush = listenForPush(next, writer, buffer, tripletChanges);
        connecting = refreshClient({
          outbox,
          request,
          writer,
          reconcile,
          subscriptions,
          remoteSubscriptions,
          transport: next,
          checkpoint: nothing,
          durable: persisted,
          isCurrent: () => current === next,
          getVersion: () => localVersion,
          buffer,
          refresh,
        }).catch((error) => {
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
      },
      /** The real address of a temporary one (itself when it is not one). */
      resolve: writer.resolve,
      /** Whether `index` is a temporary address still waiting for the server. */
      isTemporary,
      ...createRemoteTriplets({
        request,
        writer,
        outbox,
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
      /** Every temporary address that got its real one: `(temp, index)`. */
      onRemap: listenerSet(listeners.remap),
    }
  );
  if (transport) {
    synced.connect(transport).catch(() => {});
  }
  return synced;
}
