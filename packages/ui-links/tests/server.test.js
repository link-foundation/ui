/**
 * The links server: link-cli's protocol conversation
 * (`fixtures/links-operations.txt`, a copy of link-cli's
 * `docs/protocol/links-operations.txt`), the binary form, authentication,
 * subscriptions and permissions.
 */

import { describe, it, expect } from 'test-anywhere';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import {
  createLinksServer,
  createMemoryLinks,
  decodeBinary,
  encodeBinary,
  formatLino,
  parseLino,
} from '@link-foundation/ui-links';
import { world } from './helpers.js';

/** The requests of a conversation file and the replies it expects. */
function conversation(text) {
  const steps = [];
  for (const line of text.split('\n')) {
    if (line.startsWith('> ')) {
      steps.push({ request: line.slice(2), reply: [] });
    } else if (line.startsWith('! ')) {
      steps
        .at(-1)
        .reply.push(formatLino(parseLino(`(error: '${line.slice(2)}')`)));
    } else if (line !== '' && !line.startsWith('#')) {
      steps.at(-1).reply.push(line);
    }
  }
  return steps;
}

/**
 * Where ui-links answers otherwise, and why: link-cli's names store keeps a
 * name at an address of its own (100 + the link); ui-links keeps names
 * beside the links and answers with the link itself.
 */
const DEVIATIONS = { "(set-name: (2 'a pair'))": ['(link: 2)'] };

describe('links server', () => {
  it("replays link-cli's protocol conversation", () => {
    const text = readFileSync(
      new URL('./fixtures/links-operations.txt', import.meta.url),
      'utf8'
    );
    const steps = conversation(text);
    expect(steps.length).toBe(19);
    const session = createLinksServer({ links: createMemoryLinks() }).session();
    for (const { request, reply } of steps) {
      const want = DEVIATIONS[request] ?? reply;
      const got = session.request(request);
      expect([request, got]).toEqual([request, want.join('\n')]);
    }
  });

  it('answers a binary request in binary', () => {
    const session = createLinksServer({ links: createMemoryLinks() }).session();
    const reply = session.requestBinary(
      encodeBinary(parseLino('(create: (0 0))'))
    );
    expect(formatLino(decodeBinary(reply).document)).toBe('() ((1: 0 0))');
    const packet = encodeBinary(parseLino('(count: ())'));
    const cut = session.requestBinary(packet.subarray(0, packet.length - 1));
    expect(formatLino(decodeBinary(cut).document)).toBe(
      "(error: 'Incomplete binary packet')"
    );
    const bad = session.requestBinary(new Uint8Array([0x1f, 0xff, 0xff]));
    expect(formatLino(decodeBinary(bad).document)).toMatch(
      /^\(error: 'Not a binary packet/
    );
  });

  it('runs substitution queries and answers with names', () => {
    const server = createLinksServer({
      links: createMemoryLinks(),
      autoCreate: true,
    });
    const session = server.session();
    expect(session.request('() ((p: x y))')).toBe(
      '() ((p: x y))\n() ((x: x x))\n() ((y: y y))'
    );
    expect(session.request('()')).toBe('(p: x y)\n(x: x x)\n(y: y y)');
    expect(session.request('(each: (* x))')).toBe('(1: 2 3)\n(2: 2 2)');
    expect(session.request('((p: x y)) ((p: y q))')).toBe(
      '() ((q: q q))\n((p: x y)) ((p: y q))'
    );
    expect(session.request('(count: ())')).toBe('(count: 4)');
    const strict = createLinksServer({ links: createMemoryLinks() }).session();
    expect(strict.request('() ((1 1))')).toBe('() ((1: 1 1))');
    expect(strict.request('((1: 1 1)) ((1: 1 q))')).toBe(
      "(error: 'Link not found: q')"
    );
    expect(session.request('(create: (1 2 3))')).toBe(
      "(error: 'Expected (create: (source target))')"
    );
    expect(session.request('(create: (1')).toMatch(/^\(error: /);
  });

  it('authenticates and pushes changes to subscribers', () => {
    const server = createLinksServer({
      links: createMemoryLinks(),
      authenticate: (token) => (token === 'secret' ? 7 : null),
    });
    const pushed = [];
    const watcher = server.session({
      onPush: (doc) => pushed.push(formatLino(doc)),
    });
    const writer = server.session();
    expect(writer.request('(auth: wrong)')).toBe(
      "(error: 'Forbidden: authentication failed')"
    );
    expect(writer.request('(auth: secret)')).toBe('(subject: 7)');
    expect(writer.subject).toBe(7);
    expect(watcher.request('(subscribe: (* 1))')).toBe('(subscription: 1)');
    writer.request('(create: (0 0))');
    writer.request('(update: (1 1 1))');
    writer.request('(create: (2 2))');
    expect(pushed).toEqual(['(notify: 1)\n() ((1: 1 1))']);
    watcher.request('(unsubscribe: 1)');
    writer.request('(delete: 1)');
    expect(pushed.length).toBe(1);
    expect(server.sessions.length).toBe(2);
    watcher.close();
    expect(server.sessions.length).toBe(1);
  });

  it('serves each subject what its permissions allow', () => {
    const { links, names, policy, t, v } = world();
    const server = createLinksServer({ links, names, policy });
    const pushed = [];
    const alice = server.session({
      subject: v.alice,
      onPush: (doc) => pushed.push(formatLino(doc)),
    });
    const boss = server.session({ subject: v.boss });
    alice.request('(subscribe: (* * *))');
    expect(alice.request('(count: ())')).toBe('(count: 3)');
    expect(alice.request(`(update: (${v.secret} ${t.Note} ${v.secret}))`)).toBe(
      `(error: 'Link not found: ${v.secret}')`
    );
    expect(alice.request(`(set-name: (${v.note} 'mine'))`)).toBe(
      `(link: ${v.note})`
    );
    expect(alice.request("(get-by-name: 'secret')")).toBe('');
    expect(alice.request('((secret: * *)) ()')).toBe('');
    boss.request(`(update: (${v.secret} ${t.Note} ${v.secret}))`);
    expect(pushed).toEqual([
      `(notify: 1)\n() ((${v.secret}: ${t.Note} ${v.secret}))`,
    ]);
    expect(alice.request('(count: ())')).toBe('(count: 4)');
    boss.request(`(update: (${v.secret} ${t.Secret} ${v.secret}))`);
    expect(pushed[1]).toBe(
      `(notify: 1)\n((${v.secret}: ${t.Note} ${v.secret})) ()`
    );
    const guest = server.session();
    expect(guest.request('(create: (0 0))')).toBe(
      "(error: 'Forbidden: create')"
    );
  });
});

describe('links server and the links a subject creates', () => {
  it('lets a subject type the links it creates, as types it may not read', () => {
    const { links, names, policy, t, v } = world();
    const server = createLinksServer({ links, names, policy });
    const alice = server.session({ subject: v.alice });
    // alice may write notes, but may not read the link of the type Note.
    expect(alice.request(`(each: (${t.Note}))`)).toBe('');
    const n = links.count([]) + 1;
    expect(alice.request('(create: (0 0))')).toBe(`() ((${n}: 0 0))`);
    expect(alice.request(`(update: (${n} ${t.Note} ${n}))`)).toBe(
      `((${n}: 0 0)) ((${n}: ${t.Note} ${n}))`
    );
    expect(alice.request(`(create: (${t.Note} ${n}))`)).toBe(
      `() ((${n + 1}: ${t.Note} ${n}))`
    );
  });

  it('undoes a failed request and reports its own error', () => {
    const { links, names, policy, t, v } = world();
    const server = createLinksServer({ links, names, policy });
    const alice = server.session({ subject: v.alice });
    const n = links.count([]) + 1;
    alice.request('(create: (0 0))');
    // The update is allowed, then refused for its missing target: undoing it
    // needs no permission, and the error is the one of the request.
    expect(alice.request(`(update: (${n} ${t.Note} 9999))`)).toBe(
      "(error: 'Link not found: 9999')"
    );
    expect(alice.request(`(each: (${n}))`)).toBe(`(${n}: 0 0)`);
    expect(alice.request(`(update: (${n} ${t.Note} ${n}))`)).toBe(
      `((${n}: 0 0)) ((${n}: ${t.Note} ${n}))`
    );
  });

  it('does not give a subject a link made where its own was deleted', () => {
    const { links, names, policy, v } = world();
    const server = createLinksServer({ links, names, policy });
    const alice = server.session({ subject: v.alice });
    const boss = server.session({ subject: v.boss });
    const n = links.count([]) + 1;
    alice.request('(create: (0 0))');
    expect(alice.request(`(each: (${n}))`)).toBe(`(${n}: 0 0)`);
    boss.request(`(delete: ${n})`);
    expect(boss.request('(create: (0 0))')).toBe(`() ((${n}: 0 0))`);
    expect(alice.request(`(each: (${n}))`)).toBe('');
    expect(alice.request(`(update: (${n} 0 0))`)).toBe(
      `(error: 'Link not found: ${n}')`
    );
  });
});
