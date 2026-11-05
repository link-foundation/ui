/** Types as links and the permission layer over a storage. */

import { describe, it, expect } from 'test-anywhere';
import {
  allow,
  allLinks,
  createMemoryLinks,
  createNames,
  typeSystem,
  withPermissions,
} from '@link-foundation/ui-links';
import { errorCode, world } from './helpers.js';

describe('types', () => {
  it('follows sub-types and multiple inheritance', () => {
    const { types, t, v } = world();
    expect(types.isA(v.shared, t.Doc)).toBe(true);
    expect(types.isA(v.shared, t.Public)).toBe(true);
    expect(types.isA(v.note, t.Public)).toBe(false);
    expect(types.isA(v.boss, t.User)).toBe(true);
    expect(types.isA(t.Shared, t.Shared)).toBe(true);
    expect(types.typeOf(v.secret)).toBe(t.Secret);
    expect(types.isType(t.Note)).toBe(true);
    expect(types.isType(9999)).toBe(false);
    expect(types.parentsOf(t.Shared)).toEqual([t.Note, t.Public]);
    expect(types.ancestorsOf(t.Shared)).toEqual([
      t.Shared,
      t.Note,
      t.Public,
      t.Doc,
      types.root,
    ]);
  });

  it('checks a link that is not stored yet', () => {
    const { types, t } = world();
    expect(types.isA({ id: 0, from_id: t.Note, to_id: 0 }, t.Doc)).toBe(true);
  });

  it('needs an Extends marker for more parents', () => {
    const links = createMemoryLinks();
    const root = links.create();
    links.update(root, root, root);
    const types = typeSystem(links, { root });
    expect(errorCode(() => types.define(root, root))).toBe('bad-request');
  });
});

describe('permissions', () => {
  for (const separateRules of [false, true]) {
    it(`answers by type (rules ${separateRules ? 'apart' : 'with the data'})`, () => {
      const { links, policy, v } = world({ separateRules });
      const link = (id) => allLinks(links, [id])[0];
      const { alice, boss, note, shared, secret } = v;
      expect(policy.canWrite(alice, link(note))).toBe(true);
      expect(policy.canRead(alice, link(shared))).toBe(true);
      expect(policy.canRead(alice, link(secret))).toBe(false);
      expect(policy.canWrite(boss, link(secret))).toBe(true);
      expect(policy.canRead(null, link(note))).toBe(false);
      expect(policy.canCreate(alice)).toBe(true);
      expect(policy.canCreate(null)).toBe(false);
    });
  }

  it('shows a subject only what it may read', () => {
    const { links, policy, t, v } = world();
    const view = withPermissions(links, policy, v.alice);
    // The sub-type Shared is of type Note; its Extends pair is not.
    const seen = allLinks(view).map((l) => l.id);
    expect(seen).toEqual([t.Shared, v.note, v.shared]);
    expect(view.count([])).toBe(3);
    expect(errorCode(() => view.delete(v.secret))).toBe('not-found');
  });

  it('refuses writes, the storage unchanged', () => {
    const { links, policy, t, v } = world();
    const view = withPermissions(links, policy, v.alice);
    const before = allLinks(links);
    expect(errorCode(() => view.update(v.note, t.Secret, v.note))).toBe(
      'forbidden'
    );
    expect(errorCode(() => view.update(v.shared, t.Public, v.shared))).toBe(
      'forbidden'
    );
    view.update(v.shared, t.Note, v.shared);
    view.update(v.shared, t.Shared, v.shared);
    expect(allLinks(links)).toEqual(before);
    const id = view.create();
    view.update(id, 0, id);
    view.update(id, t.Note, id);
    expect(errorCode(() => view.update(id, t.Secret, id))).toBe('forbidden');
    view.delete(id);
    const guest = withPermissions(links, policy, null);
    expect(errorCode(() => guest.create())).toBe('forbidden');
  });

  it('keeps the hierarchy from who may write its values', () => {
    const { links, markers, names, policy, t, v } = world();
    allow(links, markers, 'reference', t.User, t.Admin);
    const view = withPermissions(links, policy, v.alice);
    const extendsMarker = names.getByName('Extends');
    const [pair] = allLinks(links, [undefined, t.Shared, t.Public]);
    // The link of Note itself is of type Doc.
    expect(errorCode(() => view.update(t.Note, t.Admin, t.Note))).toBe(
      'not-found'
    );
    // The pair Shared -> Public is of type Extends.
    expect(errorCode(() => view.update(pair.id, t.Shared, t.Admin))).toBe(
      'not-found'
    );
    const more = view.create();
    view.update(more, t.Shared, t.Admin);
    const mark = view.create();
    expect(errorCode(() => view.update(mark, extendsMarker, more))).toBe(
      'forbidden'
    );
    const boss = withPermissions(links, policy, v.boss);
    boss.update(pair.id, t.Shared, t.Public);
  });

  it('refuses a marker as a subject', () => {
    const { rules, markers } = world();
    expect(
      errorCode(() => allow(rules, markers, 'read', markers.allowRead, 1))
    ).toBe('bad-request');
    expect(
      errorCode(() => allow(rules, markers, 'read', markers.allowReference, 1))
    ).toBe('bad-request');
    expect(errorCode(() => allow(rules, markers, 'own', 1, 1))).toBe(
      'bad-request'
    );
    expect(createNames().getByName('AllowRead')).toBe(null);
  });
});
