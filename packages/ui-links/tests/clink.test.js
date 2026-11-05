/** One client contract, replayed against the reference and released server. */
import { describe, it, expect } from 'test-anywhere';
import {
  allLinks,
  allow,
  changesFromLino,
  connectInProcess,
  createLinksServer,
  createMemoryLinks,
  createSyncedLinks,
  createSyncedTriplets,
  getLink,
  parseLino,
} from '@link-foundation/ui-links';
import { connectLinks } from '@link-foundation/ui-links/tcp';
import {
  startClink,
  startClinkTriplets,
} from '../../../examples/lib/ui-links-clink.mjs';
import { world } from './helpers.js';

async function until(check) {
  for (let i = 0; i < 100; i++) {
    if (check()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return check();
}

/** Reference rights never grant read access, on either protocol server. */
async function checkReferences(transport, alice, boss, fixture, separateRules) {
  const { t, v, markers } = fixture;
  const reference = async (target) =>
    parseLino(await transport.send(`(create: (${t.Note} ${target}))`));
  for (const target of [99999, v.secret]) {
    expect(await reference(target)).toEqual([
      { id: 'error', values: [`Link not found: ${target}`] },
    ]);
  }
  expect(changesFromLino(await reference(v.boss))[0].after.to_id).toBe(v.boss);
  expect(await alice.load([v.boss])).toEqual([]);
  if (!separateRules) {
    const pair = boss.create();
    boss.update(pair, t.User, t.Secret);
    const grant = boss.create();
    boss.update(grant, markers.allowReference, pair);
    await boss.flush();
    expect(changesFromLino(await reference(v.secret))[0].after.to_id).toBe(
      v.secret
    );
    expect(await alice.load([v.secret])).toEqual([]);
  }
}

function referenceWorld(separateRules) {
  const fixture = world({ separateRules });
  allow(
    fixture.rules,
    fixture.markers,
    'reference',
    fixture.t.User,
    fixture.t.Admin
  );
  return fixture;
}

for (const backend of ['reference', 'clink']) {
  for (const separateRules of [false, true]) {
    describe(`${backend} synced client (rules ${separateRules ? 'apart' : 'in data'})`, () => {
      const test = backend === 'clink' && !process.env.CLINK ? it.skip : it;
      test('authenticates, filters, rolls back and synchronizes (set CLINK for released-server coverage)', async () => {
        const fixture = referenceWorld(separateRules);
        const { links, names, policy, t, v } = fixture;
        const tokens = new Map([
          ['alice-token', v.alice],
          ['boss-token', v.boss],
        ]);
        const transports = [];
        let clink;
        try {
          let connect;
          if (backend === 'clink') {
            clink = await startClink({ ...fixture, tokens });
            connect = () => connectLinks(clink.address);
          } else {
            const server = createLinksServer({
              links,
              names,
              policy,
              authenticate: (token) => tokens.get(token) ?? null,
            });
            connect = () => connectInProcess(server);
          }
          const guest = await connect();
          transports.push(guest);
          expect(
            await createSyncedLinks({ transport: guest }).load([])
          ).toEqual([]);
          expect(parseLino(await guest.send('(auth: invalid)'))[0].id).toBe(
            'error'
          );
          const signIn = async (token, subject) => {
            const transport = await connect();
            transports.push(transport);
            expect(parseLino(await transport.send(`(auth: ${token})`))).toEqual(
              [{ id: 'subject', values: [String(subject)] }]
            );
            return createSyncedLinks({ transport });
          };
          const alice = await signIn('alice-token', v.alice);
          const boss = await signIn('boss-token', v.boss);
          const errors = [];
          alice.onError((error, write) =>
            errors.push([error.code, write?.kind])
          );
          const { id: subscription } = await alice.subscribe([]);
          await boss.subscribe([]);
          expect(allLinks(alice).map((link) => link.id)).toEqual(
            [t.Shared, v.note, v.shared].sort((a, b) => a - b)
          );
          const before = getLink(alice, v.note);
          alice.update(v.note, t.Secret, v.note);
          await alice.flush();
          expect(errors).toEqual([['remote', 'update']]);
          expect(getLink(alice, v.note)).toEqual(before);
          expect((await boss.load([v.note]))[0]).toEqual(before);
          alice.disconnect();
          const draft = alice.create();
          alice.update(draft, t.Note, draft);
          expect(alice.pending).toBe(1);
          await alice.connect(transports[1]);
          await alice.flush();
          const id = alice.resolve(draft);
          expect(alice.isTemporary(draft)).toBe(false);
          expect(errors).toEqual([['remote', 'update']]);
          expect(await until(() => getLink(boss, id)?.from_id === t.Note)).toBe(
            true
          );
          // The subscriber sees a permission loss as deletion.
          boss.update(id, t.Secret, id);
          await boss.flush();
          expect(await until(() => getLink(alice, id) === null)).toBe(true);
          boss.update(id, t.Note, id);
          await boss.flush();
          expect(
            await until(() => getLink(alice, id)?.from_id === t.Note)
          ).toBe(true);
          await alice.unsubscribe(subscription);
          boss.update(id, t.Secret, id);
          await boss.flush();
          // A reply on the subscriber connection is a barrier after unsubscribe.
          await transports[1].send('(count: ())');
          expect(getLink(alice, id)?.from_id).toBe(t.Note);
          // Queries and deletes use the same protocol after outbox writes.
          await boss.query(`((${id}: Secret ${id})) ((${id}: Note ${id}))`);
          expect(getLink(boss, id)?.from_id).toBe(t.Note);
          boss.delete(id);
          await boss.flush();
          expect(await boss.load([id])).toEqual([]);

          await checkReferences(
            transports[1],
            alice,
            boss,
            fixture,
            separateRules
          );
        } finally {
          for (const transport of transports) {
            await transport.close();
          }
          await clink?.close();
        }
      });
    });
  }
}

for (const backend of ['reference', 'clink']) {
  describe(`${backend} synced triplets client`, () => {
    const test = backend === 'clink' && !process.env.CLINK ? it.skip : it;
    test('creates, reads, updates and deletes triplets, and hears of others (set CLINK for released-server coverage)', async () => {
      const transports = [];
      let clink;
      try {
        let connect;
        if (backend === 'clink') {
          clink = await startClinkTriplets();
          connect = () => connectLinks(clink.address);
        } else {
          const server = createLinksServer({
            links: createMemoryLinks(),
            triplets: true,
          });
          connect = async () => connectInProcess(server);
        }
        const open = async () => {
          const transport = await connect();
          transports.push(transport);
          const client = createSyncedTriplets();
          await client.connect(transport);
          return client;
        };
        const writer = await open();
        const reader = await open();
        await reader.subscribe();
        const refusals = [];
        writer.onError((error) => refusals.push(error.message));

        // Creates: optimistic at once, at real addresses once answered.
        const person = writer.createTripletPoint();
        const alice = writer.createTriplet(person);
        const bob = writer.createTriplet(person);
        const knows = writer.createTripletPoint();
        const edge = writer.createTriplet(knows, alice, bob);
        expect(writer.isTemporary(edge)).toBe(true);
        await writer.flush();
        const [P, A, B, K, E] = [person, alice, bob, knows, edge].map(
          writer.resolve
        );
        expect(writer.isTemporary(E)).toBe(false);
        expect(refusals).toEqual([]);

        // Reads: from the server, from another connection, and pushed.
        expect(await writer.remoteCount()).toBe(5);
        expect(await writer.load([E])).toEqual([
          { index: E, type: K, from: A, to: B },
        ]);
        expect(
          (await writer.load([null, P])).map(({ index }) => index)
        ).toEqual([P, A, B]);
        expect(await until(() => reader.count() === 5)).toBe(true);
        expect(reader.getTriplet(E)).toEqual({
          index: E,
          type: K,
          from: A,
          to: B,
        });

        // Updates, seen by the other client too.
        writer.updateTriplet(E, K, B, A);
        await writer.flush();
        expect(await writer.load([E])).toEqual([
          { index: E, type: K, from: B, to: A },
        ]);
        expect(await until(() => reader.getTriplet(E)?.from === B)).toBe(true);

        // A refused write is undone with the words of the server.
        const refused = writer.createTriplet(4000);
        await writer.flush();
        expect(writer.isTriplet(refused)).toBe(false);
        expect(refusals).toEqual(['The type 4000 is not a triplet.']);

        // Deletes cascade over what uses the triplet, here and over there.
        expect(writer.deleteTriplet(A).map(({ index }) => index)).toEqual([
          A,
          E,
        ]);
        await writer.flush();
        expect(await writer.load([A])).toEqual([]);
        expect(await writer.remoteCount()).toBe(3);
        expect(await until(() => reader.count() === 3)).toBe(true);
        expect(reader.isTriplet(E)).toBe(false);

        // A substitution query with three-part links.
        const added = await writer.query(`() ((90000: ${P} ${B} 0))`);
        expect(added.map(({ after }) => after)).toEqual([
          { index: 90000, type: P, from: B, to: 0 },
        ]);
        expect(writer.getTriplet(90000).from).toBe(B);
        expect(await until(() => reader.isTriplet(90000))).toBe(true);
      } finally {
        for (const transport of transports) {
          await transport.close();
        }
        await clink?.close();
      }
    });
  });
}
