/** The synced triplets client against the reference server, in one process. */
import { describe, it, expect } from 'test-anywhere';
import {
  ANY,
  BREAK,
  CONTINUE,
  connectInProcess,
  createLinksServer,
  createMemoryLinks,
  createNames,
  createSyncedTriplets,
  LinksError,
  MAX_ADDRESS,
} from '@link-foundation/ui-links';
import { world } from './helpers.js';

function running() {
  const links = createMemoryLinks();
  const names = createNames();
  return createLinksServer({ links, names, triplets: true });
}

const clientOf = (server) =>
  createSyncedTriplets({ transport: connectInProcess(server) });

/** The cache, one line per triplet. */
const lines = (client) =>
  client
    .eachTriplet()
    .map(({ index, type, from, to }) => `${index}: ${type} ${from} ${to}`);

describe('createSyncedTriplets', () => {
  it('creates at once, and moves to the real address of the server', async () => {
    const server = running();
    const client = clientOf(server);
    const remaps = [];
    client.onRemap((temp, index) => remaps.push([temp, index]));

    const person = client.createTripletPoint();
    expect(client.isTemporary(person)).toBe(true);
    expect(client.getTriplet(person)).toEqual({
      index: person,
      type: person,
      from: 0,
      to: 0,
    });
    const alice = client.createTriplet(person);
    const bob = client.createTriplet(person);
    const knows = client.createTriplet();
    const edge = client.createTriplet(knows, alice, bob);
    expect(client.pending).toBe(5);
    expect(client.getTriplet(edge).from).toBe(alice);

    await client.flush();
    expect(client.pending).toBe(0);
    expect(client.isTemporary(person)).toBe(false);
    expect(remaps.map(([temp]) => temp)).toEqual([
      person,
      alice,
      bob,
      knows,
      edge,
    ]);
    const real = client.resolve(edge);
    const reply = server.session().request(`(each: (${real}))`);
    expect(reply).toBe(
      `(${real}: ${client.resolve(knows)} ${client.resolve(alice)} ${client.resolve(bob)})`
    );
    expect(client.getTriplet(edge)).toEqual({
      index: real,
      type: client.resolve(knows),
      from: client.resolve(alice),
      to: client.resolve(bob),
    });
    expect(server.session().request('(count: ())')).toBe('(count: 5)');
  });

  it('reads through the one interface of every storage', async () => {
    const client = clientOf(running());
    const type = client.create();
    const first = client.create(type);
    const second = client.create(type, first, 0);
    await client.flush();

    expect(client.count()).toBe(3);
    expect(client.count({ from: client.resolve(first) })).toBe(1);
    const seen = [];
    expect(
      client.each((triplet) => {
        seen.push(triplet.index);
        return CONTINUE;
      })
    ).toBe(CONTINUE);
    expect(seen).toEqual([type, first, second].map(client.resolve));
    expect(client.each(() => BREAK, { type: client.resolve(type) })).toBe(
      BREAK
    );

    expect(client.update(second, type, 0, first)).toBe(client.resolve(second));
    expect(client.getTriplet(second).to).toBe(client.resolve(first));
    expect(client.delete(second)).toBe(client.resolve(second));
    expect(client.getTriplet(second)).toBe(null);
    await client.flush();
    expect(client.count()).toBe(2);
    expect(await client.remoteCount()).toBe(2);
  });

  it('answers an update with what was there, and refuses what it has not', async () => {
    const client = clientOf(running());
    const point = client.createTripletPoint();
    await client.flush();
    const index = client.resolve(point);
    expect(client.updateTriplet(index, index, index, 0)).toEqual({
      index,
      type: index,
      from: 0,
      to: 0,
    });
    await client.flush();
    expect(await client.load([index])).toEqual([
      { index, type: index, from: index, to: 0 },
    ]);
    for (const write of [
      () => client.updateTriplet(4000, index, 0, 0),
      () => client.deleteTriplet(4000),
    ]) {
      expect(write).toThrow('Link 4000 is not a triplet.');
    }
  });

  it('deletes what uses a triplet with it, and learns the rest from the reply', async () => {
    const server = running();
    const writer = clientOf(server);
    const point = writer.createTripletPoint();
    const user = writer.createTriplet(point);
    const hidden = writer.createTriplet(user);
    await writer.flush();

    const client = clientOf(server);
    const known = [point, user].map(writer.resolve);
    await client.load([known[0]]);
    await client.load([known[1]]);
    await client.load([writer.resolve(hidden)]);
    const changes = [];
    client.onChange((change) => changes.push(change));
    const removed = client.deleteTriplet(known[0]);
    expect(removed.map(({ index }) => index)).toEqual([
      known[0],
      known[1],
      writer.resolve(hidden),
    ]);
    expect(changes.every(({ origin }) => origin === 'local')).toBe(true);
    await client.flush();
    expect(client.count()).toBe(0);
    expect(server.session().request('(count: ())')).toBe('(count: 0)');

    // A cache that held only the first hears of the rest from the reply.
    const again = writer.createTripletPoint();
    const use = writer.createTriplet(again);
    await writer.flush();
    const partial = clientOf(server);
    await partial.load([writer.resolve(again)]);
    const heard = [];
    partial.onChange((change) => heard.push(change));
    partial.deleteTriplet(writer.resolve(again));
    await partial.flush();
    expect(partial.count()).toBe(0);
    expect(heard.map(({ origin }) => origin)).toEqual(['local']);
    expect(await partial.remoteCount([writer.resolve(use)])).toBe(0);
  });
});

describe('createSyncedTriplets with a server that answers back', () => {
  it('undoes a refused write and tells why', async () => {
    const client = clientOf(running());
    const point = client.createTripletPoint();
    await client.flush();
    const index = client.resolve(point);

    const errors = [];
    const origins = [];
    client.onError((error, write) => errors.push([error, write]));
    client.onChange(({ origin }) => origins.push(origin));

    const refused = client.createTriplet(4000);
    expect(client.isTriplet(refused)).toBe(true);
    await client.flush();
    expect(client.isTriplet(refused)).toBe(false);

    client.updateTriplet(index, 0, 0, 0);
    expect(client.getTriplet(index).type).toBe(0);
    await client.flush();
    expect(client.getTriplet(index).type).toBe(index);

    expect(errors.map(([error]) => error.message)).toEqual([
      'The type 4000 is not a triplet.',
      'The type of a triplet cannot be 0.',
    ]);
    expect(errors.every(([error]) => error instanceof LinksError)).toBe(true);
    expect(errors.map(([, write]) => write.kind)).toEqual(['create', 'update']);
    expect(origins).toEqual(['local', 'rollback', 'local', 'rollback']);
  });

  it('brings back what a refused delete took, and reads what its subject may', async () => {
    const { t, v, policy, links, names } = world();
    const server = createLinksServer({
      links,
      names,
      policy,
      triplets: true,
      authenticate: (token) => v[token] ?? null,
    });
    const signedIn = async (token) => {
      const transport = connectInProcess(server);
      await transport.send(`(auth: ${token})`);
      return createSyncedTriplets({ transport });
    };
    const alice = await signedIn('alice');
    const boss = await signedIn('boss');
    const errors = [];
    alice.onError((error) => errors.push(error.message));

    await alice.load();
    expect(alice.isTriplet(v.note)).toBe(true);
    expect(alice.isTriplet(v.secret)).toBe(false);

    const refused = alice.createTriplet(t.Secret);
    await alice.flush();
    expect(alice.isTriplet(refused)).toBe(false);
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain('Forbidden');

    // A triplet the subject cannot see uses the note: the server refuses.
    await boss.load([v.note]);
    boss.createTriplet(t.Secret, v.note, v.note);
    await boss.flush();
    const note = alice.getTriplet(v.note);
    expect(alice.deleteTriplet(v.note)).toEqual([note]);
    expect(alice.isTriplet(v.note)).toBe(false);
    await alice.flush();
    expect(alice.getTriplet(v.note)).toEqual(note);
    expect(errors.length).toBe(2);
    expect(errors[1]).toContain('Forbidden');
  });

  it('keeps subscribers up to date and leaves their own writes to them', async () => {
    const server = running();
    const writer = clientOf(server);
    const reader = clientOf(server);
    const point = writer.createTripletPoint();
    await writer.flush();
    const type = writer.resolve(point);

    const origins = [];
    const { id, triplets } = await reader.subscribe([null, type]);
    expect(triplets).toEqual([{ index: type, type, from: 0, to: 0 }]);
    reader.onChange(({ origin }) => origins.push(origin));

    const first = writer.createTriplet(type);
    const other = writer.createTripletPoint();
    await writer.flush();
    expect(lines(reader)).toEqual([
      `${type}: ${type} 0 0`,
      `${writer.resolve(first)}: ${type} 0 0`,
    ]);
    writer.deleteTriplet(first);
    await writer.flush();
    expect(reader.count()).toBe(1);
    expect(reader.isTriplet(writer.resolve(other))).toBe(false);
    expect(origins).toEqual(['remote', 'remote']);

    await reader.unsubscribe(id);
    writer.createTriplet(type);
    await writer.flush();
    expect(reader.count()).toBe(1);
  });

  it('runs a substitution query after the queued writes, by name', async () => {
    const server = running();
    const client = clientOf(server);
    const point = client.createTripletPoint();
    await client.flush();
    const index = client.resolve(point);
    server.session().request(`(set-name: (${index} Person))`);

    const created = client.createTriplet(index);
    const changes = await client.query('() ((90000: Person 0 0))');
    expect(client.isTemporary(created)).toBe(false);
    expect(changes).toEqual([
      {
        before: null,
        after: { index: 90000, type: index, from: 0, to: 0 },
      },
    ]);
    expect(client.getTriplet(90000).type).toBe(index);
  });
});

describe('createSyncedTriplets without a connection', () => {
  it('keeps writes offline, and reads everything again on reconnect', async () => {
    const server = running();
    const client = createSyncedTriplets();
    const offline = client.createTripletPoint();
    expect(client.connected).toBe(false);
    expect(client.pending).toBe(1);
    expect(client.isTemporary(offline)).toBe(true);

    await client.connect(connectInProcess(server));
    await client.flush();
    expect(client.pending).toBe(0);
    const index = client.resolve(offline);

    const { id } = await client.subscribe();
    client.disconnect();
    const late = client.createTriplet(index);

    const other = clientOf(server);
    await other.load();
    const gone = other.createTriplet(index);
    await other.flush();
    other.deleteTriplet(gone);
    const added = other.createTriplet(index);
    await other.flush();

    await client.connect(connectInProcess(server));
    await client.flush();
    expect(client.pending).toBe(0);
    expect(client.eachTriplet().map(({ index: at }) => at)).toEqual(
      [index, client.resolve(late), other.resolve(added)].sort((a, b) => a - b)
    );

    // The subscription came along: a later write of the other client is pushed.
    const pushed = other.createTriplet(index);
    await other.flush();
    expect(client.isTriplet(other.resolve(pushed))).toBe(true);
    await client.unsubscribe(id);
  });

  it('drops a triplet deleted while it was offline', async () => {
    const server = running();
    const client = clientOf(server);
    const point = client.createTripletPoint();
    await client.flush();
    const index = client.resolve(point);
    client.disconnect();
    server.session().request(`(delete: ${index})`);
    await client.connect(connectInProcess(server));
    await client.flush();
    expect(client.isTriplet(index)).toBe(false);
  });

  it('reports the failure of a transport and keeps the write', async () => {
    const client = createSyncedTriplets();
    const errors = [];
    client.onError((error, write) => errors.push([error.message, write]));
    client.createTripletPoint();
    await client
      .connect({
        send: () => Promise.reject(new Error('The line is down')),
        onPush: () => () => {},
      })
      .catch(() => {});
    expect(client.connected).toBe(false);
    expect(client.pending).toBe(1);
    expect(errors).toEqual([['The line is down', null]]);
  });
});

/** A transport whose requests can wait: `hold()` until `release()`. */
function holdable(server) {
  const inner = connectInProcess(server);
  let gate = null;
  let open = () => {};
  return {
    transport: {
      ...inner,
      send: async (text) => {
        await gate;
        return inner.send(text);
      },
    },
    hold() {
      gate = new Promise((resolve) => {
        open = resolve;
      });
    },
    release() {
      gate = null;
      open();
    },
  };
}

const onServer = (server, index) =>
  server.session().request(`(each: (${index}))`);

/** A type, a triplet `i` of it, and two more types, all answered. */
async function typed(client) {
  const [a, q, r] = [
    client.createTripletPoint(),
    client.createTripletPoint(),
    client.createTripletPoint(),
  ];
  const i = client.createTriplet(a);
  await client.flush();
  return {
    a: client.resolve(a),
    q: client.resolve(q),
    r: client.resolve(r),
    i: client.resolve(i),
  };
}

describe('createSyncedTriplets keeps to what the server said', () => {
  it('never gives a temporary address the value that means any', async () => {
    const client = createSyncedTriplets();
    const point = client.createTripletPoint();
    const made = [point];
    for (let n = 0; n < 8; n++) {
      made.push(client.createTriplet(point));
    }
    expect(made.includes(ANY)).toBe(false);
    expect(made.every((index) => index <= MAX_ADDRESS)).toBe(true);
    client.deleteTriplet(made[8]);
    expect(client.countTriplets()).toBe(8);
  });

  it('takes an update of its own that the server took after a push', async () => {
    const server = running();
    const other = clientOf(server);
    const { q, r, i } = await typed(other);
    const { transport, hold, release } = holdable(server);
    const client = createSyncedTriplets({ transport });
    await client.subscribe([]);

    hold();
    client.updateTriplet(i, q, 0, 0);
    other.updateTriplet(i, r, 0, 0);
    await other.flush();
    expect(client.getTriplet(i).type).toBe(q);
    release();
    await client.flush();
    expect(onServer(server, i)).toBe(`(${i}: ${q} 0 0)`);
    expect(client.getTriplet(i).type).toBe(q);
  });

  it('keeps a triplet that left one subscription for another', async () => {
    const server = running();
    const writer = clientOf(server);
    const { a, q, i } = await typed(writer);
    for (const order of [
      [[], [null, a]],
      [[null, a], []],
    ]) {
      writer.updateTriplet(i, a, 0, 0);
      await writer.flush();
      const client = clientOf(server);
      await client.subscribe(order[0]);
      await client.subscribe(order[1]);
      writer.updateTriplet(i, q, 0, 0);
      await writer.flush();
      expect(client.getTriplet(i)).toEqual({
        index: i,
        type: q,
        from: 0,
        to: 0,
      });
    }
  });

  it('still drops a triplet deleted under both subscriptions', async () => {
    const server = running();
    const writer = clientOf(server);
    const { a, i } = await typed(writer);
    const client = clientOf(server);
    await client.subscribe([]);
    await client.subscribe([null, a]);
    writer.deleteTriplet(i);
    await writer.flush();
    expect(client.getTriplet(i)).toBe(null);
  });
});

describe('createSyncedTriplets after a refusal', () => {
  it('forgets a refused update, with an accepted one before or after it', async () => {
    const server = running();
    const client = clientOf(server);
    const { a, q, i } = await typed(client);
    const errors = [];
    client.onError((error) => errors.push(error.message));

    client.updateTriplet(i, 99999, 0, 0);
    client.updateTriplet(i, q, 0, 0);
    await client.flush();
    expect(client.getTriplet(i).type).toBe(q);
    expect(onServer(server, i)).toBe(`(${i}: ${q} 0 0)`);

    client.updateTriplet(i, a, 0, 0);
    client.updateTriplet(i, 99999, 0, 0);
    await client.flush();
    expect(client.getTriplet(i).type).toBe(a);

    client.updateTriplet(i, 99998, 0, 0);
    client.updateTriplet(i, 99999, 0, 0);
    await client.flush();
    expect(client.getTriplet(i).type).toBe(a);
    expect(errors.length).toBe(4);
  });

  it('undoes a refused update to what another client wrote meanwhile', async () => {
    const server = running();
    const other = clientOf(server);
    const { q, i } = await typed(other);
    const { transport, hold, release } = holdable(server);
    const client = createSyncedTriplets({ transport });
    await client.subscribe([]);

    hold();
    client.updateTriplet(i, 99999, 0, 0);
    other.updateTriplet(i, q, 0, 0);
    await other.flush();
    release();
    await client.flush();
    expect(onServer(server, i)).toBe(`(${i}: ${q} 0 0)`);
    expect(client.getTriplet(i).type).toBe(q);
  });

  it('leaves no phantom of a refused create, whatever came after it', async () => {
    const server = running();
    const client = clientOf(server);
    const errors = [];
    client.onError((error) => errors.push(error.message));

    const deleted = client.createTriplet(99999, 0, 0);
    client.deleteTriplet(deleted);
    const updated = client.createTriplet(99999, 0, 0);
    client.updateTriplet(updated, 99998, 0, 0);
    const user = client.createTriplet(99999, 0, 0);
    const child = client.createTriplet(user, 0, 0);
    await client.flush();

    expect(lines(client)).toEqual([]);
    expect(client.pending).toBe(0);
    for (const temp of [deleted, updated, user, child]) {
      expect(client.isTemporary(temp)).toBe(false);
      expect(client.getTriplet(temp)).toBe(null);
    }
    expect(errors.length).toBe(6);
    expect(server.session().request('(count: ())')).toBe('(count: 0)');
  });
});

describe('createSyncedTriplets with old addresses and queued writes', () => {
  it('loads under the writes still queued', async () => {
    const server = running();
    const client = clientOf(server);
    const { q, r, i } = await typed(client);
    client.updateTriplet(i, q, 0, 0);
    client.updateTriplet(i, r, 0, 0);
    await client.load();
    expect(client.getTriplet(i).type).toBe(r);
    await client.flush();
    expect(client.getTriplet(i).type).toBe(r);
    expect(onServer(server, i)).toBe(`(${i}: ${r} 0 0)`);
  });

  it('reads with a temporary address that has its real one', async () => {
    const client = clientOf(running());
    const point = client.createTripletPoint();
    const one = client.createTriplet(point);
    await client.flush();
    const real = client.resolve(one);
    expect(
      client.eachTriplet({ type: point }).some((t) => t.index === real)
    ).toBe(true);
    expect(client.eachTriplet([one]).length).toBe(1);
    expect(client.countTriplets({ index: one })).toBe(1);
  });
});
