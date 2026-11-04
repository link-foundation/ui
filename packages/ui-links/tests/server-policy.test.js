/** Subscription visibility follows rule and hierarchy writes. */
import { describe, it, expect } from 'test-anywhere';
import {
  allLinks,
  connectInProcess,
  createSyncedLinks,
  createLinksServer,
  formatLino,
} from '@link-foundation/ui-links';
import { world } from './helpers.js';

function fixture() {
  const data = world();
  const server = createLinksServer(data);
  const pushed = [];
  const alice = server.session({
    subject: data.v.alice,
    onPush: (doc) => pushed.push(formatLino(doc)),
  });
  const boss = server.session({ subject: data.v.boss });
  return { ...data, server, alice, boss, pushed };
}

const notification = (id, type, creation) =>
  `(notify: 1)\n${creation ? `() ((${id}: ${type} ${id}))` : `((${id}: ${type} ${id})) ()`}`;

function create(boss, links, source, target) {
  const reply = boss.request(`(create: (${source} ${target}))`);
  expect(reply.startsWith('(error:')).toBe(false);
  return allLinks(links).at(-1).id;
}

describe('subscription policy changes', () => {
  for (const access of ['allowRead', 'allowWrite']) {
    it(`pushes grants and revocations through ${access}`, () => {
      const { alice, boss, links, markers, t, v, pushed } = fixture();
      alice.request('(subscribe: (* * *))');
      const rule = create(boss, links, t.User, t.Secret);
      expect(pushed).toEqual([]);
      const mark = create(boss, links, markers[access], rule);
      expect(pushed).toEqual([notification(v.secret, t.Secret, true)]);
      boss.request(`(delete: ${mark})`);
      expect(pushed).toEqual([
        notification(v.secret, t.Secret, true),
        notification(v.secret, t.Secret, false),
      ]);
    });
  }

  it('batches every newly visible link once per matching subscription', () => {
    const { alice, boss, links, types, markers, t, v, pushed } = fixture();
    const second = types.instance(t.Secret);
    alice.request('(subscribe: (* * *))');
    alice.request(`(subscribe: (${v.note}))`);
    const rule = create(boss, links, t.User, t.Secret);
    const mark = create(boss, links, markers.allowRead, rule);
    expect(pushed).toEqual([
      `${notification(v.secret, t.Secret, true)}\n() ((${second}: ${t.Secret} ${second}))`,
    ]);
    boss.request(`(delete: ${mark})`);
    expect(pushed[1]).toBe(
      `${notification(v.secret, t.Secret, false)}\n((${second}: ${t.Secret} ${second})) ()`
    );
  });

  it('follows updates to a marked rule and its subject', () => {
    const { alice, boss, links, markers, t, v, pushed } = fixture();
    alice.request(`(subscribe: (${v.secret}))`);
    const rule = create(boss, links, t.Admin, t.Secret);
    create(boss, links, markers.allowRead, rule);
    expect(pushed).toEqual([]);
    boss.request(`(update: (${rule} ${t.User} ${t.Secret}))`);
    expect(pushed).toEqual([notification(v.secret, t.Secret, true)]);
    boss.request(`(update: (${rule} ${t.Admin} ${t.Secret}))`);
    expect(pushed[1]).toBe(notification(v.secret, t.Secret, false));
  });

  it('follows primary inheritance and changes to the subject type', () => {
    const { alice, boss, t, v, pushed } = fixture();
    alice.request(`(subscribe: (${v.secret}))`);
    boss.request(`(update: (${t.Secret} ${t.Note} ${t.Secret}))`);
    expect(pushed).toEqual([notification(v.secret, t.Secret, true)]);
    boss.request(`(update: (${t.Secret} ${t.Doc} ${t.Secret}))`);
    expect(pushed[1]).toBe(notification(v.secret, t.Secret, false));
    boss.request(`(update: (${v.alice} ${t.Admin} ${v.alice}))`);
    expect(pushed[2]).toBe(notification(v.secret, t.Secret, true));
    boss.request(`(update: (${v.alice} ${t.User} ${v.alice}))`);
    expect(pushed[3]).toBe(notification(v.secret, t.Secret, false));
  });

  it('follows Extends marks and pairs', () => {
    const { alice, boss, links, names, t, v, pushed } = fixture();
    alice.request(`(subscribe: (* ${v.secret}))`);
    const pair = create(boss, links, t.Secret, t.Public);
    const mark = create(boss, links, names.getByName('Extends'), pair);
    expect(pushed).toEqual([notification(v.secret, t.Secret, true)]);
    boss.request(`(update: (${pair} ${t.Secret} ${t.Doc}))`);
    expect(pushed[1]).toBe(notification(v.secret, t.Secret, false));
    boss.request(`(update: (${pair} ${t.Secret} ${t.Public}))`);
    expect(pushed[2]).toBe(notification(v.secret, t.Secret, true));
    boss.request(`(delete: ${mark})`);
    expect(pushed[3]).toBe(notification(v.secret, t.Secret, false));
  });

  it('updates guests for Anything and respects unsubscribe', () => {
    const { server, boss, links, markers, t, v } = fixture();
    const pushed = [];
    const guest = server.session({
      onPush: (doc) => pushed.push(formatLino(doc)),
    });
    guest.request(`(subscribe: (${v.secret}))`);
    const rule = create(boss, links, markers.anything, t.Secret);
    const mark = create(boss, links, markers.allowRead, rule);
    expect(pushed).toEqual([notification(v.secret, t.Secret, true)]);
    guest.request('(unsubscribe: 1)');
    boss.request(`(delete: ${mark})`);
    expect(pushed.length).toBe(1);
  });
});

describe('atomic subscription policy delivery', () => {
  it('combines visibility and data writes once and ignores failed transactions', () => {
    const { alice, boss, links, markers, t, v, pushed } = fixture();
    alice.request(`(subscribe: (${v.secret}))`);
    const rule = create(boss, links, t.User, t.Secret);
    const mark = create(boss, links, 0, 0);
    boss.request(
      `((${mark}: 0 0) (${v.secret}: ${t.Secret} ${v.secret})) ((${mark}: ${markers.allowRead} ${rule}) (${v.secret}: ${t.Secret} ${v.note}))`
    );
    expect(pushed).toEqual([
      `(notify: 1)\n() ((${v.secret}: ${t.Secret} ${v.note}))`,
    ]);
    boss.request(`((${mark}: * *)) ((${mark}: 0 99999))`);
    expect(pushed.length).toBe(1);
    boss.request(`(delete: ${rule})`);
    expect(pushed[1]).toBe(
      `(notify: 1)\n((${v.secret}: ${t.Secret} ${v.note})) ()`
    );
  });

  it('retains access while another grant still permits reading', () => {
    const { alice, boss, links, markers, t, v, pushed } = fixture();
    alice.request(`(subscribe: (${v.secret}))`);
    const rule = create(boss, links, t.User, t.Secret);
    const read = create(boss, links, markers.allowRead, rule);
    const write = create(boss, links, markers.allowWrite, rule);
    boss.request(`(delete: ${read})`);
    expect(pushed).toEqual([notification(v.secret, t.Secret, true)]);
    boss.request(`(update: (${write} 0 0))`);
    expect(pushed[1]).toBe(notification(v.secret, t.Secret, false));
  });
});

describe('subscription policy caching and clients', () => {
  it('rescans only subjects mentioned by a rule', () => {
    const data = world();
    const reads = [];
    const watch = data.policy.watch();
    data.policy.watch = () => ({
      ...watch,
      canRead(subject, link) {
        if (link.id === data.v.secret) {
          reads.push(subject);
        }
        return watch.canRead(subject, link);
      },
    });
    const server = createLinksServer(data);
    const alice = server.session({ subject: data.v.alice, onPush() {} });
    const guest = server.session({ onPush() {} });
    const boss = server.session({ subject: data.v.boss });
    alice.request(`(subscribe: (${data.v.secret}))`);
    guest.request(`(subscribe: (${data.v.secret}))`);
    const rule = create(boss, data.links, data.t.User, data.t.Secret);
    const mark = create(boss, data.links, data.markers.allowRead, rule);
    boss.request(`(delete: ${mark})`);
    expect(reads).toEqual([data.v.alice, data.v.alice]);
  });

  it('caches readable types per subject until an affected rule changes', () => {
    const { policy, types, links, t, v } = world();
    let checks = 0;
    const isA = types.isA;
    types.isA = (...args) => {
      checks++;
      return isA(...args);
    };
    const watch = policy.watch();
    const secret = allLinks(links, [v.secret])[0];
    expect(watch.canRead(v.alice, secret)).toBe(false);
    const initial = checks;
    expect(initial > 0).toBe(true);
    watch.canRead(v.alice, secret);
    expect(checks).toBe(initial);
    const before = allLinks(links, [v.note])[0];
    links.update(v.note, t.Note, v.shared);
    watch.refresh([{ before, after: allLinks(links, [v.note])[0] }], links);
    watch.canRead(v.alice, secret);
    expect(checks).toBe(initial);
  });

  it('pushes indirect visibility changes to the writer too', () => {
    const { server, boss, links, markers, t, v } = fixture();
    const pushed = [];
    const alice = server.session({
      subject: v.alice,
      onPush: (doc) => pushed.push(formatLino(doc)),
    });
    // Give alice write access to existing rule pairs and permission marks.
    const pair = create(boss, links, t.User, t.Secret);
    const mark = create(boss, links, 0, 0);
    const userRules = create(boss, links, t.User, t.User);
    create(boss, links, markers.allowWrite, userRules);
    const markRules = create(boss, links, t.User, markers.allowRead);
    create(boss, links, markers.allowWrite, markRules);
    alice.request(`(subscribe: (${v.secret}))`);
    // boss creates the marker; alice can then revoke the marked grant.
    boss.request(`(update: (${mark} ${markers.allowRead} ${pair}))`);
    expect(pushed).toEqual([notification(v.secret, t.Secret, true)]);
    alice.request(`(delete: ${mark})`);
    expect(pushed[1]).toBe(notification(v.secret, t.Secret, false));
  });

  it('adds and removes the newly readable links in a synced client cache', async () => {
    const { server, boss, links, markers, t, v } = fixture();
    const transport = connectInProcess(server, { subject: v.alice });
    const client = createSyncedLinks({ transport });
    try {
      await client.subscribe([]);
      expect(client.count([v.secret])).toBe(0);
      const rule = create(boss, links, t.User, t.Secret);
      const mark = create(boss, links, markers.allowRead, rule);
      expect(allLinks(client, [v.secret])).toEqual(allLinks(links, [v.secret]));
      boss.request(`(delete: ${mark})`);
      expect(client.count([v.secret])).toBe(0);
    } finally {
      transport.close();
    }
  });
});
