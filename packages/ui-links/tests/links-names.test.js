import { describe, it, expect } from 'test-anywhere';
import * as ui from '@link-foundation/ui-links';

describe('names stored as links', () => {
  it('reopens unicode names from the doublets alone', () => {
    const links = ui.createMemoryLinks();
    const id = links.create();
    const names = ui.createLinksNames(links);
    names.setName(id, "Hello 🦄 é \\ quote'");
    const copy = ui.createMemoryLinks();
    ui.linksFromLino(copy, ui.linksToLino(links));
    expect(ui.createLinksNames(copy).entries()).toEqual(names.entries());
  });
});

describe('links names integration', () => {
  const setup = () => {
    const links = ui.createMemoryLinks();
    const id = links.create();
    const other = links.create();
    const names = ui.createLinksNames(links);
    names.setName(id, 'old');
    return { links, id, other, names };
  };

  it('keeps the names interface, reassigns names, and validates input', () => {
    const { links, names, id, other } = setup();
    expect(names.getByName('old')).toBe(id);
    names.setName(other, 'old');
    expect(names.getName(id)).toBe(null);
    expect(names.entries()).toEqual([[other, 'old']]);
    expect(names.removeName(other)).toBe(true);
    expect(names.removeName(other)).toBe(false);
    for (const value of ['', '*', '$x', '123']) {
      expect(() => names.setName(id, value)).toThrow();
    }
    expect(() => names.setName(9999, 'absent')).toThrow();
    names.setName(id, 'new');
    ui.deleteCascade(links, id);
    expect(names.getByName('new')).toBe(null);
    expect(names.entries()).toEqual([]);
  });

  it('runs queries atomically including their name links', () => {
    const { links, names, id } = setup();
    const before = ui.allLinks(links);
    expect(() =>
      ui.runQuery({ links, names }, '() ((fresh: 9999 0))')
    ).toThrow();
    expect(ui.allLinks(links)).toEqual(before);
    expect(names.getName(id)).toBe('old');
    expect(names.getByName('fresh')).toBe(null);
    ui.runQuery({ links, names, autoCreate: true }, '() ((new: x y))');
    expect(names.getByName('new')).not.toBe(null);
    const copy = ui.createMemoryLinks();
    const copyNames = ui.createLinksNames(copy);
    ui.linksFromLino(copy, '(hello: hello hello)', { names: copyNames });
    expect(copyNames.getByName('hello')).not.toBe(null);
    expect(ui.namesToLino(copyNames)).toContain('hello');
  });

  it('loads names and pushes rename, reassignment and removal for one target', async () => {
    const { links, names, id, other } = setup();
    const server = ui.createLinksServer({ links, names });
    const transport = ui.connectInProcess(server);
    const client = ui.createSyncedLinks({ transport });
    const writer = server.session();
    try {
      await client.subscribe([id]);
      expect(client.names.getName(id)).toBe('old');
      expect(ui.getLink(client, other)).toBe(null);
      expect(writer.request(`(set-name: (${id} 'renamed 🦄'))`)).toBe(
        `(link: ${id})`
      );
      expect(client.names.getName(id)).toBe('renamed 🦄');
      expect(client.names.getByName('old')).toBe(null);
      writer.request(`(set-name: (${other} 'renamed 🦄'))`);
      expect(client.names.getName(id)).toBe(null);
      writer.request(`(set-name: (${id} 'again'))`);
      expect(client.names.getName(id)).toBe('again');
      writer.request(`(remove-name: ${id})`);
      expect(client.names.getName(id)).toBe(null);
      writer.request(`(set-name: (${id} 'deleted'))`);
      writer.request(`(delete: ${id})`);
      expect(client.names.getByName('deleted')).toBe(null);
    } finally {
      transport.close();
      writer.close();
    }
  });

  it('checks both the named link and each encoding link for reads and writes', async () => {
    const { links, names, id } = setup();
    const dependency = names
      .dependencies([id])
      .find((link) => link.from_id === id);
    const hidden = new Set([dependency.id]);
    const policy = {
      canRead: (subject, link) => subject === 1 || !hidden.has(link.id),
      canWrite: (subject) => subject === 1,
      canCreate: (subject) => subject === 1,
    };
    const server = ui.createLinksServer({ links, names, policy });
    const guest = server.session({ subject: 2 });
    const owner = server.session({ subject: 1 });
    const transport = ui.connectInProcess(server, { subject: 2 });
    const client = ui.createSyncedLinks({ transport });
    try {
      expect(guest.request(`(get-name: ${id})`)).toBe('');
      expect(guest.request('(get-by-name: old)')).toBe('');
      expect(guest.request('((old: * *)) ()')).toBe('');
      expect(guest.request('()')).not.toContain('old');
      await client.subscribe([id]);
      expect(client.names.getName(id)).toBe(null);
      owner.request(`(set-name: (${id} 'next'))`);
      hidden.add(id);
      expect(guest.request(`(get-name: ${id})`)).toBe('');
      expect(guest.request('(get-by-name: next)')).toBe('');
      expect(guest.request('(name-links: (1))')).toBe('');
      const before = ui.allLinks(links);
      expect(guest.request(`(set-name: (${id} 'forbidden'))`)).toContain(
        'error'
      );
      expect(ui.allLinks(links)).toEqual(before);
    } finally {
      transport.close();
      guest.close();
      owner.close();
    }
  });

  it('rolls back a rename when an encoding write is refused', () => {
    const { links, names, id } = setup();
    const policy = {
      canRead: () => true,
      canWrite: (subject, link) => link.id === id || link.from_id === 0,
      canCreate: () => true,
    };
    const server = ui.createLinksServer({ links, names, policy });
    const before = ui.allLinks(links);
    expect(server.session().request(`(set-name: (${id} 'refused'))`)).toContain(
      'error'
    );
    expect(ui.allLinks(links)).toEqual(before);
    expect(names.getName(id)).toBe('old');
  });
});

describe('links names storage and protocol coverage', () => {
  it('persists names through the normal Links Notation adapter', async () => {
    let text = '';
    const adapter = () =>
      ui.linoTextAdapter({
        read: () => text,
        write: (next) => {
          text = next;
        },
      });
    const links = await ui.persistLinks(ui.createMemoryLinks(), adapter());
    const id = links.create();
    const names = ui.createLinksNames(links);
    names.setName(id, 'persisted 🦄');
    await links.flush();
    const reopened = await ui.persistLinks(ui.createMemoryLinks(), adapter());
    expect(ui.createLinksNames(reopened).getName(id)).toBe('persisted 🦄');
  });

  it('round-trips named LiNo exports with a links-backed names store', () => {
    const links = ui.createMemoryLinks();
    const id = links.create();
    links.update(id, id, id);
    const names = ui.createLinksNames(links);
    names.setName(id, 'named');
    const copy = ui.createMemoryLinks();
    const copiedNames = ui.createLinksNames(copy);
    ui.linksFromLino(copy, ui.linksToLino(links, { names }), {
      names: copiedNames,
    });
    expect(copiedNames.getName(id)).toBe('named');
    expect(ui.allLinks(copy)).toEqual(ui.allLinks(links));
  });

  it('serves binary name operations and query names to a synced client', async () => {
    const links = ui.createMemoryLinks();
    const names = ui.createLinksNames(links);
    const server = ui.createLinksServer({ links, names, autoCreate: true });
    const session = server.session();
    const id = links.create();
    const reply = session.requestBinary(
      ui.encodeBinary(ui.parseLino(`(set-name: (${id} 'binary'))`))
    );
    expect(ui.formatLino(ui.decodeBinary(reply).document)).toBe(
      `(link: ${id})`
    );
    expect(session.request('(get-by-name: binary)')).toBe(`(link: ${id})`);
    const transport = ui.connectInProcess(server);
    const client = ui.createSyncedLinks({ transport });
    try {
      await client.query('() ((fresh: left right))');
      expect(client.names.getByName('fresh')).toBe(names.getByName('fresh'));
      expect(client.names.getByName('left')).toBe(names.getByName('left'));
    } finally {
      transport.close();
      session.close();
    }
  });

  it('ignores malformed or cyclic text without recursing', () => {
    const links = ui.createMemoryLinks();
    const id = links.create();
    const names = ui.createLinksNames(links);
    names.setName(id, 'cycle');
    const dependencies = names.dependencies([id]);
    const binding = dependencies.find((link) => link.from_id === id);
    const node = ui.getLink(links, binding.to_id);
    links.update(node.id, node.from_id, node.id);
    expect(names.getName(id)).toBe(null);
  });
});

describe('partial names cache refresh', () => {
  it('refreshes removals on load and keeps names from overlapping subscriptions', async () => {
    const links = ui.createMemoryLinks();
    const a = links.create();
    const b = links.create();
    const names = ui.createLinksNames(links);
    names.setName(a, 'alpha');
    names.setName(b, 'beta');
    const server = ui.createLinksServer({ links, names });
    const transport = ui.connectInProcess(server);
    const client = ui.createSyncedLinks({ transport });
    const writer = server.session();
    try {
      await client.load([a]);
      writer.request(`(remove-name: ${a})`);
      await client.load([a]);
      expect(client.names.getName(a)).toBe(null);
      writer.request(`(set-name: (${a} 'alpha'))`);
      await client.subscribe([a]);
      await client.subscribe([b]);
      writer.request(`(remove-name: ${a})`);
      expect(client.names.getName(a)).toBe(null);
      expect(client.names.getName(b)).toBe('beta');
    } finally {
      transport.close();
      writer.close();
    }
  });

  it('sends a rename made through one synced client to another', async () => {
    const links = ui.createMemoryLinks();
    const id = links.create();
    const names = ui.createLinksNames(links);
    names.setName(id, 'before');
    const server = ui.createLinksServer({ links, names });
    const ta = ui.connectInProcess(server);
    const tb = ui.connectInProcess(server);
    const a = ui.createSyncedLinks({ transport: ta });
    const b = ui.createSyncedLinks({ transport: tb });
    try {
      await a.load([id]);
      await b.subscribe([id]);
      a.names.setName(id, 'after');
      await a.flush();
      expect(names.getName(id)).toBe('after');
      expect(b.names.getName(id)).toBe('after');
      expect(a.names.getName(id)).toBe('after');
    } finally {
      ta.close();
      tb.close();
    }
  });
});

describe('names protocol compatibility', () => {
  it('loads and queries a server with only the original sidecar operations', async () => {
    const server = ui.createLinksServer({
      links: ui.createMemoryLinks(),
      autoCreate: true,
    });
    const session = server.session();
    const client = ui.createSyncedLinks({
      transport: {
        send: async (text) => {
          const [operation] = ui.parseLino(text);
          return ['load', 'name-links'].includes(operation.id)
            ? "(error: 'Unknown extension')"
            : session.request(text);
        },
      },
    });
    try {
      await client.query('() ((one: one one))');
      expect((await client.load([])).length).toBe(1);
    } finally {
      session.close();
    }
  });
});

describe('hidden name conflicts', () => {
  it('refuses to replace or duplicate a hidden name through a writable data view', () => {
    const links = ui.createMemoryLinks();
    const id = links.create();
    const other = links.create();
    const names = ui.createLinksNames(links);
    names.setName(id, 'private');
    const hidden = names.bindings([id])[0].id;
    const policy = {
      canRead: (subject, link) => link.id !== hidden,
      canWrite: () => true,
      canCreate: () => true,
    };
    const server = ui.createLinksServer({ links, names, policy });
    const session = server.session();
    const before = ui.allLinks(links);
    expect(session.request(`(set-name: (${id} 'changed'))`)).toContain('error');
    expect(session.request(`(remove-name: ${id})`)).toContain('error');
    expect(session.request(`(set-name: (${other} 'private'))`)).toContain(
      'error'
    );
    expect(session.request('() ((private: 0 0))')).toContain('error');
    expect(ui.allLinks(links)).toEqual(before);
    expect(names.entries()).toEqual([[id, 'private']]);
    session.close();
  });
});

describe('links-backed names server conformance', () => {
  it('supports numeric and named read/update/delete operations with metadata counted as links', () => {
    const links = ui.createMemoryLinks();
    const names = ui.createLinksNames(links);
    const session = ui.createLinksServer({ links, names }).session();
    try {
      expect(session.request('(create: (0 0))')).toBe('() ((1: 0 0))');
      expect(session.request('(set-name: (1 item))')).toBe('(link: 1)');
      expect(session.request('(count: ())')).toBe(`(count: ${links.count()})`);
      expect(session.request('(each: (item))')).toBe('(1: 0 0)');
      expect(session.request('(update: (item item item))')).toBe(
        '((1: 0 0)) ((1: 1 1))'
      );
      expect(session.request('((item: item item)) ((item: item item))')).toBe(
        '((item: item item)) ((item: item item))'
      );
      expect(session.request('(get-name: item)')).toBe('(name: item)');
      session.request('(delete: item)');
      expect(session.request('(get-by-name: item)')).toBe('');
      expect(names.entries()).toEqual([]);
    } finally {
      session.close();
    }
  });

  it('requires every individual encoding doublet to be readable', () => {
    const links = ui.createMemoryLinks();
    const id = links.create();
    const names = ui.createLinksNames(links);
    names.setName(id, 'text');
    for (const hidden of names.dependencies([id])) {
      const view = ui.withPermissions(
        links,
        {
          canRead: (subject, link) => link.id !== hidden.id,
          canWrite: () => false,
          canCreate: () => false,
        },
        null
      );
      const restricted = names.withLinks(view);
      expect(restricted.getName(id)).toBe(null);
      expect(restricted.getByName('text')).toBe(null);
      expect(restricted.entries()).toEqual([]);
    }
  });
});
