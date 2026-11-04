/** One client contract, replayed against the reference and released server. */
import { describe, it, expect } from 'test-anywhere';
import {
  allLinks,
  connectInProcess,
  createLinksServer,
  createSyncedLinks,
  getLink,
  parseLino,
} from '@link-foundation/ui-links';
import { connectLinks } from '@link-foundation/ui-links/tcp';
import { startClink } from '../../../examples/lib/ui-links-clink.mjs';
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

for (const backend of ['reference', 'clink']) {
  for (const separateRules of [false, true]) {
    describe(`${backend} synced client (rules ${separateRules ? 'apart' : 'in data'})`, () => {
      const test = backend === 'clink' && !process.env.CLINK ? it.skip : it;
      test('authenticates, filters, rolls back and synchronizes (set CLINK for released-server coverage)', async () => {
        const fixture = world({ separateRules });
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
