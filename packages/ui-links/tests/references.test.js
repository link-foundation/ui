/**
 * A reference needs a right: without it an unreadable address answers exactly
 * as a missing one (issue 119, docs/case-studies/issue-119).
 */

import { describe, it, expect } from 'test-anywhere';
import {
  allLinks,
  allow,
  createLinksNames,
  createLinksServer,
  withPermissions,
} from '@link-foundation/ui-links';
import { errorCode, world } from './helpers.js';

const MISSING = 9999;

function fixture() {
  const data = world();
  const server = createLinksServer(data);
  return {
    ...data,
    alice: server.session({ subject: data.v.alice }),
    boss: server.session({ subject: data.v.boss }),
  };
}

/** A note of alice's own, and its address. */
function ownNote({ alice, links, t }) {
  const id = links.count([]) + 1;
  expect(alice.request(`(create: (${t.Note} 0))`)).toBe(
    `() ((${id}: ${t.Note} 0))`
  );
  return id;
}

/** The reply with the address taken out, to compare two addresses. */
const shape = (reply, address) => reply.replaceAll(String(address), 'N');

describe('references without the right', () => {
  const requests = {
    '(create: (Note address))': ({ t }, address) =>
      `(create: (${t.Note} ${address}))`,
    '(create: (0 address))': (_, address) => `(create: (0 ${address}))`,
    '(update: (own Note address))': ({ t }, address, own) =>
      `(update: (${own} ${t.Note} ${address}))`,
    'a query': ({ t }, address) => `() ((${t.Note} ${address}))`,
    'a query that picks the address': ({ t }, address) =>
      `() ((${address}: ${t.Note} ${t.Note}))`,
  };
  for (const [name, request] of Object.entries(requests)) {
    it(`answers ${name} alike for an unreadable and a missing address`, () => {
      const data = fixture();
      const own = ownNote(data);
      const before = allLinks(data.links);
      const hidden = data.alice.request(request(data, data.v.secret, own));
      const missing = data.alice.request(request(data, MISSING, own));
      expect(hidden).toBe(`(error: 'Link not found: ${data.v.secret}')`);
      expect(missing).toBe(`(error: 'Link not found: ${MISSING}')`);
      expect(shape(hidden, data.v.secret)).toBe(shape(missing, MISSING));
      expect(allLinks(data.links)).toEqual(before);
    });
  }

  it('answers a type it may not write alike too', () => {
    const data = fixture();
    const own = ownNote(data);
    for (const type of [data.t.Secret, MISSING]) {
      expect(data.alice.request(`(update: (${own} ${type} ${own}))`)).toBe(
        `(error: 'Forbidden: update ${own}')`
      );
    }
  });

  it('answers a name of an unreadable link as an unknown name', () => {
    const { alice, t } = fixture();
    const missing = `(error: 'Link not found: nothing')`;
    expect(alice.request(`(create: (${t.Note} nothing))`)).toBe(missing);
    expect(alice.request(`(create: (${t.Note} secret))`)).toBe(
      missing.replace('nothing', 'secret')
    );
    expect(alice.request('(each: (nothing))')).toBe(missing);
    expect(alice.request('(each: (secret))')).toBe(
      missing.replace('nothing', 'secret')
    );
    expect(alice.request(`() ((${t.Note} secret))`)).toBe(
      missing.replace('nothing', 'secret')
    );
  });

  it('does not let a subject take the name of an unreadable link', () => {
    const { alice, names, v } = fixture();
    expect(alice.request(`(set-name: (${v.note} 'secret'))`)).toBe(
      "(error: 'Forbidden: hidden name')"
    );
    expect(alice.request('() ((secret: 1 1))')).toBe(
      "(error: 'Forbidden: hidden name')"
    );
    expect(names.getByName('secret')).toBe(v.secret);
  });

  it('answers alike on a storage that cannot create at an address', () => {
    const data = world();
    delete data.links.createAt;
    const alice = createLinksServer(data).session({ subject: data.v.alice });
    const { t, v } = data;
    const before = allLinks(data.links);
    for (const address of [v.secret, MISSING]) {
      expect(alice.request(`() ((${address}: ${t.Note} ${t.Note}))`)).toBe(
        `(error: 'Link not found: ${address}')`
      );
    }
    expect(allLinks(data.links)).toEqual(before);
  });

  it('answers a name stored as links alike too', () => {
    const data = world();
    const names = createLinksNames(data.links);
    names.setName(data.v.secret, 'secret');
    const alice = createLinksServer({ ...data, names }).session({
      subject: data.v.alice,
    });
    for (const name of ['secret', 'nothing']) {
      expect(alice.request(`(create: (${data.t.Note} ${name}))`)).toBe(
        `(error: 'Link not found: ${name}')`
      );
    }
  });

  it('refuses it through the view alone', () => {
    const { links, policy, t, v } = world();
    const view = withPermissions(links, policy, v.alice);
    const id = view.create();
    for (const address of [v.secret, MISSING]) {
      expect(errorCode(() => view.update(id, t.Note, address))).toBe(
        'not-found'
      );
      expect(errorCode(() => view.update(id, 0, address))).toBe('not-found');
      expect(errorCode(() => view.createAt(address))).toBe('not-found');
    }
    expect(allLinks(links, [id])).toEqual([{ id, from_id: 0, to_id: 0 }]);
  });
});

describe('references with the right', () => {
  it('allows the links of the types of an AllowReference rule', () => {
    const data = fixture();
    const { alice, links, markers, t, v } = data;
    allow(links, markers, 'reference', t.User, t.Secret);
    const n = links.count([]) + 1;
    expect(alice.request(`(create: (${t.Note} ${v.secret}))`)).toBe(
      `() ((${n}: ${t.Note} ${v.secret}))`
    );
    // The type of the rule itself too.
    expect(alice.request(`(create: (${t.Note} ${t.Secret}))`)).toBe(
      `() ((${n + 1}: ${t.Note} ${t.Secret}))`
    );
    // Not its sibling, and a missing address stays missing.
    expect(alice.request(`(create: (${t.Note} ${t.Admin}))`)).toBe(
      `(error: 'Link not found: ${t.Admin}')`
    );
    expect(alice.request(`(create: (${t.Note} ${MISSING}))`)).toBe(
      `(error: 'Link not found: ${MISSING}')`
    );
  });

  it('does not make the link readable', () => {
    const { alice, links, markers, policy, t, v } = fixture();
    allow(links, markers, 'reference', t.User, t.Secret);
    const secret = allLinks(links, [v.secret])[0];
    expect(policy.canReference(v.alice, secret)).toBe(true);
    expect(policy.canRead(v.alice, secret)).toBe(false);
    expect(alice.request(`(each: (${v.secret}))`)).toBe('');
    expect(alice.request("(get-by-name: 'secret')")).toBe('');
    expect(alice.request(`(delete: ${v.secret})`)).toBe(
      `(error: 'Link not found: ${v.secret}')`
    );
  });

  it('applies to the subjects of the rule only', () => {
    const { links, markers, policy, t, v } = world();
    allow(links, markers, 'reference', t.Admin, t.Secret);
    const secret = allLinks(links, [v.secret])[0];
    expect(policy.canReference(v.boss, secret)).toBe(true);
    expect(policy.canReference(v.alice, secret)).toBe(false);
    expect(policy.canReference(null, secret)).toBe(false);
  });

  it('comes with a rule that names the type', () => {
    const { alice, links, t, v } = fixture();
    const n = links.count([]) + 1;
    // User writes Note and reads Public: both types may be referenced, even
    // though neither link is readable.
    expect(alice.request(`(each: (${t.Public}))`)).toBe('');
    expect(alice.request(`(create: (${t.Note} ${t.Note}))`)).toBe(
      `() ((${n}: ${t.Note} ${t.Note}))`
    );
    expect(alice.request(`(create: (${t.Note} ${t.Public}))`)).toBe(
      `() ((${n + 1}: ${t.Note} ${t.Public}))`
    );
    // Readable links and the subject itself need no rule.
    expect(alice.request(`(create: (${t.Note} ${v.shared}))`)).toBe(
      `() ((${n + 2}: ${t.Note} ${v.shared}))`
    );
    expect(alice.request(`(create: (${t.Note} ${v.alice}))`)).toBe(
      `() ((${n + 3}: ${t.Note} ${v.alice}))`
    );
  });

  it('keeps a reference the subject did not add', () => {
    const { alice, boss, links, t, v } = fixture();
    const n = links.count([]) + 1;
    boss.request(`(create: (${t.Note} ${v.secret}))`);
    // The boss linked a note to the secret: alice sees the address, and may
    // change the note as long as no new reference is added.
    expect(alice.request(`(update: (${n} ${t.Shared} ${v.secret}))`)).toBe(
      `((${n}: ${t.Note} ${v.secret})) ((${n}: ${t.Shared} ${v.secret}))`
    );
    alice.request(`(update: (${n} ${t.Shared} ${n}))`);
    expect(alice.request(`(update: (${n} ${t.Shared} ${v.secret}))`)).toBe(
      `(error: 'Link not found: ${v.secret}')`
    );
  });

  it('brings the previous behaviour back with one rule', () => {
    const { alice, links, markers, t, v } = fixture();
    allow(links, markers, 'reference', markers.anything, markers.anything);
    const n = links.count([]) + 1;
    expect(alice.request(`(create: (${t.Note} ${v.secret}))`)).toBe(
      `() ((${n}: ${t.Note} ${v.secret}))`
    );
    // It may be told apart now: the link exists, the other one does not.
    expect(alice.request(`(create: (${t.Note} ${MISSING}))`)).toBe(
      `(error: 'Link not found: ${MISSING}')`
    );
    expect(alice.request(`(create: (${t.Note} secret))`)).toBe(
      `() ((${n + 1}: ${t.Note} ${v.secret}))`
    );
    expect(alice.request(`() ((${v.secret}: ${t.Note} ${t.Note}))`)).toBe(
      `(error: 'Link ${v.secret} exists')`
    );
  });

  it('leaves a subject that may read everything as it was', () => {
    const { boss, links, t, v } = fixture();
    const n = links.count([]) + 1;
    expect(boss.request(`(create: (${t.Note} ${v.secret}))`)).toBe(
      `() ((${n}: ${t.Note} ${v.secret}))`
    );
    expect(boss.request(`(create: (${t.Note} ${MISSING}))`)).toBe(
      `(error: 'Link not found: ${MISSING}')`
    );
    expect(boss.request(`() ((${MISSING}: ${t.Note} ${t.Note}))`)).toBe(
      `() ((${MISSING}: Note Note))`
    );
  });
});
