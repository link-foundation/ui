import { describe, it, expect } from 'test-anywhere';
import {
  createMinilinks,
  createDeepClient,
  createMemoryLinks,
  createLinksServer,
  connectInProcess,
  createSyncedTriplets,
  LinksError,
} from '@link-foundation/ui-links';
import { world, errorCode } from './helpers.js';

// Ported cases from deeplinks tests/minilinks{,-query}.ts at
// 381207dda313ab3c1fed0a4bfc2ddbe631750411 (Unlicense).
describe('minilinks compatibility', () => {
  const rows = [
    { id: 1, type_id: 3 },
    { id: 3, type_id: 3, from_id: 1, to_id: 2 },
    { id: 5, type_id: 3, from_id: 7, to_id: 3 },
  ];
  it('ports boolean and typed relation queries', () => {
    const ml = createMinilinks();
    ml.add(rows);
    for (const [where, ids] of [
      [{ _or: [{ id: 1 }, { id: 3 }] }, [1, 3]],
      [{ _and: [{ type_id: 3 }, { id: 3 }] }, [3]],
      [{ _not: { id: 3 } }, [1, 5]],
      [{ id: { _in: [3] } }, [3]],
      [{ id: { _gt: 2 } }, [3, 5]],
      [{ typed: { from_id: 7 } }, [3]],
      [{ from: { id: 1 } }, [3]],
      [{ to: { id: 3 } }, [5]],
      [{ in: { id: 5 } }, [3]],
      [{ out: { id: 3 } }, [1]],
      [{ type: { id: 3 } }, [1, 3, 5]],
    ]) {
      expect(ml.query(where).map((l) => l.id)).toEqual(ids);
    }
    expect(ml.query({ _or: [] })).toEqual([]);
    expect(ml.query({ _and: [] }).length).toBe(3);
    expect(ml.query({ from_id: { _is_null: true } }).map((l) => l.id)).toEqual([
      1,
    ]);
    expect(() => ml.query({ from_id: undefined })).toThrow();
    expect(() => ml.query({ id: { _unknown: 1 } })).toThrow();
    expect(() => createMinilinks().query({ id: { _unknown: 1 } })).toThrow();
  });
  it('ports add/remove relations and overlapping named applies', () => {
    const ml = createMinilinks();
    expect(ml.add(rows).anomalies.length).toBe(2);
    expect(ml.add([rows[0]]).errors.length).toBe(1);
    ml.add([{ id: 2, type_id: 1 }]);
    expect(ml.byId[3].to.id).toBe(2);
    ml.remove([2]);
    expect(ml.byId[3].to).toBe(undefined);
    const other = createMinilinks();
    other.apply(rows.slice(0, 2), 'one');
    other.apply(rows.slice(1), 'two');
    expect(other.byId[3]._applies).toEqual(['one', 'two']);
    other.apply([], 'one');
    expect(other.links.map((l) => l.id)).toEqual([3, 5]);
    other.apply([], 'two');
    expect(other.links).toEqual([]);
  });
  it('queries values, orders, paginates and notifies without a clock', () => {
    const ml = createMinilinks();
    ml.apply([
      { id: 1, string: { value: 'abc' } },
      { id: 2, number: { value: 0 } },
    ]);
    expect(ml.query({ string: { value: 'abc' } }).map((l) => l.id)).toEqual([
      1,
    ]);
    expect(
      ml.query({ number: { value: { _eq: 0 } } }).map((l) => l.id)
    ).toEqual([2]);
    expect(
      ml.query({ order_by: { id: 'desc' }, limit: 1 }).map((l) => l.id)
    ).toEqual([2]);
    const seen = [];
    const sub = ml
      .subscribe({ id: 2 })
      .subscribe({ next: (v) => seen.push(v.length) });
    ml.apply([]);
    sub.unsubscribe();
    ml.apply([{ id: 2 }]);
    expect(seen).toEqual([1, 0]);
  });
});

describe('DeepClient over synced triplets', () => {
  it('validates nested values before writing and resolves named package paths', async () => {
    const synced = createSyncedTriplets();
    const deep = createDeepClient(synced);
    expect(
      await errorCode(() =>
        deep.insert({
          out: { data: { number: { data: { value: Infinity } } } },
        })
      )
    ).toBe('bad-request');
    expect(synced.pending).toBe(0);
    const pkg = (await deep.insert({ string: { data: { value: 'demo' } } }))
      .data[0].id;
    const type = (await deep.insert({})).data[0].id;
    await deep.insert({
      from_id: pkg,
      to_id: type,
      string: { data: { value: 'Type' } },
    });
    expect(deep.idLocal('demo', 'Type')).toBe(type);
    expect(deep.idLocal('missing', true)).toBe(0);
    await deep.insert({ link_id: type, value: 0 }, { table: 'numbers' });
    expect(
      (
        await deep.select(
          { link_id: type },
          { table: 'numbers', remote: false }
        )
      ).data[0].value
    ).toBe(0);
    expect(
      (await deep.select(type, { remote: false })).data[0].number.value
    ).toBe(0);
    await deep.delete({ link_id: type }, { table: 'numbers' });
    expect((await deep.select(type, { remote: false })).data[0].value).toBe(
      undefined
    );
    deep.close();
  });
  it('preserves named applies when remapping and removes refused optimistic writes', async () => {
    const synced = createSyncedTriplets();
    const deep = createDeepClient(synced);
    const id = (await deep.insert({})).data[0].id;
    await deep.select(id, { remote: false, apply: 'space' });
    const server = createLinksServer({
      links: createMemoryLinks(),
      triplets: true,
    });
    await synced.connect(connectInProcess(server));
    await deep.flush();
    expect(deep.ml.byId[synced.resolve(id)]._applies.includes('space')).toBe(
      true
    );
    expect(deep.ml.byId[id]).toBe(undefined);
    expect((await deep.select(id, { remote: false })).data[0].id).toBe(
      synced.resolve(id)
    );
    deep.close();

    const refused = createSyncedTriplets({
      transport: {
        send: async () => {
          throw new LinksError('forbidden', 'Refused');
        },
      },
    });
    const client = createDeepClient(refused);
    expect(await errorCode(() => client.insert({}))).toBe('forbidden');
    expect(client.ml.links).toEqual([]);
    expect(refused.pending).toBe(0);
    client.close();
  });
  it('delegates can to the permission policy, including inherited types', async () => {
    const { policy, t, v } = world();
    const deep = createDeepClient(createSyncedTriplets(), {
      policy,
      subject: v.alice,
      actions: { 123: 'read' },
    });
    const shared = (await deep.insert({ type_id: t.Shared })).data[0].id;
    const secret = (await deep.insert({ type_id: t.Secret })).data[0].id;
    expect(await deep.can(shared)).toBe(true);
    expect(await deep.can(shared, v.alice, 123)).toBe(true);
    expect(await deep.can(secret, v.alice, 'read')).toBe(false);
    expect(await deep.can(secret, v.boss, 'write')).toBe(true);
    deep.close();
  });
  it('keeps optimistic dependent ids and values through remaps and reload', async () => {
    const server = createLinksServer({
      links: createMemoryLinks(),
      triplets: true,
    });
    const synced = createSyncedTriplets();
    const deep = createDeepClient(synced);
    const type = (await deep.insert({})).data[0].id;
    const first = (
      await deep.insert({
        type_id: type,
        string: { data: { value: 'hello 🌍' } },
      })
    ).data[0].id;
    const second = (
      await deep.insert({
        type_id: type,
        from_id: first,
        object: { data: { value: { a: [0, false, null] } } },
      })
    ).data[0].id;
    expect(synced.isTemporary(first)).toBe(true);
    expect(deep.minilinks.byId[second].from.id).toBe(first);
    const transport = connectInProcess(server);
    await synced.connect(transport);
    await deep.flush();
    const real = synced.resolve(first);
    expect(deep.minilinks.byId[synced.resolve(second)].from.id).toBe(real);
    expect(deep.minilinks.byId[real].value.value).toBe('hello 🌍');
    const other = createDeepClient(
      createSyncedTriplets({ transport: connectInProcess(server) })
    );
    const found = await other.select({ string: { value: 'hello 🌍' } });
    expect(found.data.map((l) => l.id)).toEqual([real]);
    await other.update({ link_id: real }, { value: '' }, { table: 'strings' });
    expect((await other.select(real)).data[0].value.value).toBe('');
    await other.delete(real);
    expect(
      (await other.select({})).data.some((l) => l.id === synced.resolve(second))
    ).toBe(false);
    deep.close();
    other.close();
  });
});
