/** Doublets keep server observations beneath writes that are still queued. */
import { describe, it, expect } from 'test-anywhere';
import {
  allLinks,
  connectInProcess,
  createLinksServer,
  createMemoryLinks,
  createSyncedLinks,
  getLink,
  LinksError,
  linoTextAdapter,
  openSyncedLinks,
  parseLino,
} from '@link-foundation/ui-links';

async function fixture() {
  const links = createMemoryLinks();
  for (let n = 0; n < 3; n++) {
    links.create();
  }
  const server = createLinksServer({ links });
  const inner = connectInProcess(server);
  let gate = null;
  let release;
  let failed = false;
  const transport = {
    ...inner,
    async send(text) {
      await gate;
      if (failed) {
        throw new LinksError('offline', 'Connection lost');
      }
      return inner.send(text);
    },
  };
  const client = createSyncedLinks({ transport });
  await client.subscribe();
  return {
    server,
    client,
    transport,
    remote: connectInProcess(server),
    hold() {
      gate = new Promise((resolve) => {
        release = resolve;
      });
    },
    release() {
      gate = null;
      release();
    },
    fail() {
      failed = true;
    },
  };
}

describe('doublets sync under overlapping writes', () => {
  it('discards refused updates with accepted writes before or after them', async () => {
    const { server, client } = await fixture();
    const errors = [];
    client.onError((error) => errors.push(error.message));
    for (const sources of [
      [99998, 2],
      [3, 99999],
      [99998, 99999],
    ]) {
      for (const source of sources) {
        client.update(1, source, 0);
      }
      await client.flush();
      expect(allLinks(client)).toEqual(allLinks(server.links));
    }
    expect(errors.length).toBe(4);
  });

  for (const accepted of [true, false]) {
    it(`keeps a newer push beneath ${accepted ? 'an accepted' : 'a refused'} optimistic update`, async () => {
      const f = await fixture();
      f.hold();
      f.client.update(1, accepted ? 2 : 99999, 0);
      await f.remote.send('(update: (1 3 0))');
      expect(getLink(f.client, 1).from_id).toBe(accepted ? 2 : 99999);
      f.release();
      await f.client.flush();
      expect(allLinks(f.client)).toEqual(allLinks(f.server.links));
      expect(getLink(f.client, 1).from_id).toBe(accepted ? 2 : 3);
    });
  }

  it('does not resurrect a remotely deleted link after a refused update', async () => {
    const f = await fixture();
    f.hold();
    f.client.update(1, 2, 0);
    await f.remote.send('(delete: 1)');
    f.release();
    await f.client.flush();
    expect(getLink(f.client, 1)).toBe(null);
    expect(allLinks(f.client)).toEqual(allLinks(f.server.links));
  });

  it('keeps links that leave one subscription while still matching another', async () => {
    for (const order of [
      [[], [null, 0]],
      [[null, 0], []],
    ]) {
      const { server, remote } = await fixture();
      const client = createSyncedLinks({ transport: connectInProcess(server) });
      for (const restriction of order) {
        await client.subscribe(restriction);
      }
      await remote.send('(update: (1 2 0))');
      expect(getLink(client, 1)).toEqual({ id: 1, from_id: 2, to_id: 0 });
      await remote.send('(delete: 1)');
      expect(getLink(client, 1)).toBe(null);
    }
  });

  it('leaves no phantom links after refused creates and dependent writes', async () => {
    const { server, client } = await fixture();
    const errors = [];
    client.onError((error) => errors.push(error.message));
    const deleted = client.create();
    client.update(deleted, 99999, 0);
    client.delete(deleted);
    const updated = client.create();
    client.update(updated, 99999, 0);
    // This update must remain separate from the create it depends on.
    client.update(updated, updated, deleted);
    const child = client.create();
    client.update(child, updated, 0);
    await client.flush();
    expect(allLinks(client)).toEqual(allLinks(server.links));
    for (const id of [deleted, updated, child]) {
      expect(getLink(client, id)).toBe(null);
      expect(client.isTemporary(id)).toBe(false);
    }
    expect(client.pending).toBe(0);
    expect(errors.length).toBe(5);
  });

  it('loads server rows beneath queued optimistic writes', async () => {
    const f = await fixture();
    const inner = f.transport.send;
    let wrote = false;
    f.transport.send = async (text) => {
      const reply = await inner(text);
      if (parseLino(text)[0]?.id === 'load' && !wrote) {
        wrote = true;
        f.client.update(1, 3, 0);
      }
      return reply;
    };
    await f.client.load();
    expect(getLink(f.client, 1).from_id).toBe(3);
    await f.client.flush();
    expect(allLinks(f.client)).toEqual(allLinks(f.server.links));
  });

  it('persists rollback records rebased on pushes across a reload', async () => {
    const f = await fixture();
    let text = '';
    const adapter = () =>
      linoTextAdapter({
        read: () => text,
        write: (value) => {
          text = value;
        },
      });
    const client = await openSyncedLinks({
      adapter: adapter(),
      transport: f.transport,
    });
    await client.subscribe();
    f.hold();
    client.update(1, 99998, 0);
    client.update(1, 99999, 0);
    await f.remote.send('(update: (1 3 0))');
    client.disconnect();
    f.fail();
    f.release();
    await client.flush();
    const reloaded = await openSyncedLinks({ adapter: adapter() });
    expect(getLink(reloaded, 1).from_id).toBe(99999);
    const rollbacks = [];
    reloaded.onChange(({ origin, after }) => {
      if (origin === 'rollback') {
        rollbacks.push(after?.from_id);
      }
    });
    await reloaded.connect(connectInProcess(f.server));
    expect(rollbacks).toEqual([3]);
    expect(allLinks(reloaded)).toEqual(allLinks(f.server.links));
  });
});
