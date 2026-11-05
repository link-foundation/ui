import { describe, it, expect } from 'test-anywhere';
import {
  createDeepClient,
  createSyncedDeepLinks,
} from '@link-foundation/ui-links';
import { startDeepClink } from '../../../examples/lib/deep-clink.mjs';
import { formatLino, group, named } from '../src/lino.js';

const test = process.env.CLINK ? it : it.skip;
const rows = [
  { id: 1, type_id: 1, from_id: 0, to_id: 0 },
  { id: 2, type_id: 1, from_id: 0, to_id: 0 },
  { id: 3, type_id: 1, from_id: 2, to_id: 1 },
];
function observe(observable) {
  const queue = [],
    waiters = [];
  const subscription = observable.subscribe({
    next: (value) =>
      waiters.length ? waiters.shift().resolve(value) : queue.push(value),
    error: (error) =>
      waiters.splice(0).forEach((waiter) => waiter.reject(error)),
  });
  return {
    next: () =>
      queue.length
        ? Promise.resolve(queue.shift())
        : new Promise((resolve, reject) => waiters.push({ resolve, reject })),
    close: () => subscription.unsubscribe(),
  };
}
function readOnlyRules() {
  return formatLino([
    group([
      group([]),
      group([
        named('Type', ['Type', 'Type']),
        named('Extends', ['Extends', 'Extends']),
        named('AllowRead', ['AllowRead', 'AllowRead']),
        named('AllowWrite', ['AllowWrite', 'AllowWrite']),
        named('Anything', ['Anything', 'Anything']),
        group(['AllowRead', group(['Anything', 'Anything'])]),
      ]),
    ]),
  ]);
}
describe('DeepClient against released clink (set CLINK)', () => {
  test('reads actual permission grants and refuses a write without permission', async () => {
    const rules = readOnlyRules();
    const server = await startDeepClink({
      rows: [
        ...rows,
        { id: 20, type_id: 1, string: '@deep-foundation/core' },
        { id: 21, type_id: 1, from_id: 20, to_id: 1, string: 'AllowSelect' },
        { id: 22, type_id: 1, from_id: 20, to_id: 2, string: 'AllowUpdate' },
      ],
      rules,
      args: ['--permissions', 'self'],
    });
    const synced = createSyncedDeepLinks({ url: server.url });
    const deep = createDeepClient(synced);
    try {
      expect(await deep.can(3, 2, 1)).toBe(true);
      expect(await deep.can(3, 2, 2)).toBe(false);
      let refused = false;
      try {
        await deep.insert({ type_id: 1 });
      } catch {
        refused = true;
      }
      expect(refused).toBe(true);
      expect(deep.ml.links.some((row) => synced.isTemporary(row.id))).toBe(
        false
      );
    } finally {
      deep.close();
      synced.close();
      await server.close();
    }
  });
  test('sends boolean and relation filters, persists all native values and reloads after restart', async () => {
    const server = await startDeepClink({ rows });
    const clients = [];
    const operations = [];
    const client = () => {
      const synced = createSyncedDeepLinks({
        url: server.url,
        trace: (op) => operations.push(op),
      });
      clients.push(synced);
      return createDeepClient(synced);
    };
    let deep;
    try {
      deep = client();
      const where = {
        _and: [{ type: { id: { _eq: 1 } } }, { _not: { id: { _in: [1] } } }],
        _or: [{ from: { id: 2 } }, { id: 2 }],
      };
      expect((await deep.select(where)).data.map((l) => l.id)).toEqual([2, 3]);
      expect(operations.at(-1).variables.where._or[0].from.id).toEqual({
        _eq: 2,
      });
      expect(
        (await deep.select({ in: { id: 3 } })).data.map((l) => l.id)
      ).toEqual([1]);
      expect(
        (await deep.select({ out: { to_id: 1 } })).data.map((l) => l.id)
      ).toEqual([2]);
      for (const [query, ids] of [
        [{ to: { id: 1 } }, [3]],
        [{ typed: { id: 3 } }, [1]],
        [{ from_id: { _is_null: true } }, []],
        [{ from_id: { _is_null: false } }, [1, 2, 3]],
      ]) {
        expect((await deep.select(query)).data.map((row) => row.id)).toEqual(
          ids
        );
      }
      const a = (
        await deep.insert({
          type_id: 1,
          string: { data: { value: 'hello 🌍' } },
        })
      ).data[0].id;
      const b = (
        await deep.insert({
          type_id: 1,
          from_id: a,
          number: { data: { value: 0 } },
        })
      ).data[0].id;
      const c = (
        await deep.insert({
          type_id: 1,
          object: { data: { value: { a: [0, false, null] } } },
        })
      ).data[0].id;
      expect(deep.ml.byId[b].from.id).toBe(a);
      await deep.update({ link_id: a }, { value: '' }, { table: 'strings' });
      expect((await deep.select(a)).data[0].string.value).toBe('');
      deep.close();
      clients.forEach((s) => s.close());
      await server.restart();
      deep = client();
      expect((await deep.select(b)).data[0].number.value).toBe(0);
      expect((await deep.select(c)).data[0].object.value).toEqual({
        a: [0, false, null],
      });
      await deep.delete(a);
      expect((await deep.select({ id: { _in: [a, b] } })).data).toEqual([]);
      expect(await deep.can(1, 2, 3)).toBe(false);
    } finally {
      deep?.close();
      clients.forEach((s) => s.close());
      await server.close();
    }
  });
  for (const protocol of ['graphql-ws', 'graphql-transport-ws']) {
    test(`streams changes and disposes overlapping ${protocol} subscriptions`, async () => {
      const server = await startDeepClink({ rows });
      const synced = createSyncedDeepLinks({ url: server.url, protocol });
      const deep = createDeepClient(synced);
      const all = observe(deep.subscribe({ type_id: 1 }));
      const filtered = observe(deep.subscribe({ from_id: 2 }));
      try {
        expect((await all.next()).data.length).toBe(3);
        expect((await filtered.next()).data.map((row) => row.id)).toEqual([3]);
        await deep.update(3, { from_id: 0 });
        expect(
          (await all.next()).data.find((row) => row.id === 3).from_id
        ).toBe(0);
        expect((await filtered.next()).data).toEqual([]);
        expect(deep.ml.byId[3].from_id).toBe(0);
        await deep.delete(3);
        expect((await all.next()).data.length).toBe(2);
        expect(deep.ml.byId[3]).toBe(undefined);
      } finally {
        all.close();
        filtered.close();
        deep.close();
        synced.close();
        await server.close();
      }
    });
  }
});
