/**
 * Triplets over doublets, case for case with link-cli's
 * `rust/tests/triplets_over_doublets_tests.rs` and with the same pseudo-random
 * sequence in the parity test.
 */

import { describe, it, expect } from 'test-anywhere';
import {
  allLinks,
  createMemoryLinks,
  createNames,
  getLink,
  linkOf,
  runQuery,
  withTriplets,
} from '../src/index.js';

const store = () => {
  const links = createMemoryLinks();
  return withTriplets(links, { names: createNames() });
};

const triplet = (index, type, from, to) => ({ index, type, from, to });
const doublet = (triplets, id) => getLink(triplets.doublets, id);
const doublets = (triplets) => allLinks(triplets.doublets);

/** Every doublet is a marker, a triplet, or a wrapper or pair still in use. */
function expectNoOrphans(triplets, { foreign = false } = {}) {
  for (const link of doublets(triplets)) {
    const { kind } = triplets.roleOf(link.id);
    if (kind === 'wrapper' || kind === 'pair' || kind === 'duplicate-pair') {
      expect(triplets.doubletUsages(link.id) > 0).toBe(true);
    } else if (kind === 'foreign') {
      expect(foreign).toBe(true);
    }
  }
}

function people(triplets) {
  const root = triplets.createTripletPoint();
  const type = () => triplets.createTriplet(root, 0, 0);
  const person = type();
  const knows = type();
  const alice = triplets.createTriplet(person, 0, 0);
  const bob = triplets.createTriplet(person, 0, 0);
  const carol = triplets.createTriplet(person, 0, 0);
  return { root, person, knows, alice, bob, carol };
}

describe('withTriplets', () => {
  it('keeps the interface of every storage', () => {
    const triplets = store();
    for (const method of ['create', 'update', 'delete', 'count', 'each']) {
      expect(typeof triplets[method]).toBe('function');
    }
    const id = triplets.create();
    expect(triplets.count({ id })).toBe(1);
  });

  it('has markers that are named points, found again', () => {
    const links = createMemoryLinks();
    const names = createNames();
    const triplets = withTriplets(links, { names });
    const { pair, nothing } = triplets.markers;
    expect(names.getByName('Pair')).toBe(pair);
    expect(names.getByName('Nothing')).toBe(nothing);
    for (const marker of [pair, nothing]) {
      expect(doublet(triplets, marker)).toEqual(linkOf(marker, marker, marker));
      expect(triplets.roleOf(marker)).toEqual({ kind: 'marker' });
      expect(triplets.isTriplet(marker)).toBe(false);
    }
    expect(withTriplets(links, { names }).markers).toEqual(triplets.markers);
  });

  it('keeps its markers in the links by default', () => {
    const links = createMemoryLinks();
    const triplets = withTriplets(links);
    const again = withTriplets(links);
    expect(again.markers).toEqual(triplets.markers);
    expect(again.names.getByName('Pair')).toBe(triplets.markers.pair);
    // The doublets of the names are not triplets.
    expect(again.countTriplets()).toBe(0);
    const root = again.createTripletPoint();
    expect(again.eachTriplet()).toEqual([triplet(root, root, 0, 0)]);
  });

  it('stores nodes and links', () => {
    const triplets = store();
    const { pair: marker } = triplets.markers;
    const p = people(triplets);
    expect(doublet(triplets, p.root)).toEqual(linkOf(p.root, p.root, p.root));
    expect(doublet(triplets, p.alice)).toEqual(
      linkOf(p.alice, p.person, p.alice)
    );
    expect(triplets.getTriplet(p.alice)).toEqual(
      triplet(p.alice, p.person, 0, 0)
    );
    expect(triplets.getTriplet(p.root)).toEqual(triplet(p.root, p.root, 0, 0));

    const link = triplets.createTriplet(p.knows, p.alice, p.bob);
    expect(triplets.getTriplet(link)).toEqual(
      triplet(link, p.knows, p.alice, p.bob)
    );
    const outer = doublet(triplets, link);
    expect(outer.from_id).toBe(p.knows);
    const pair = doublet(triplets, outer.to_id);
    expect(pair.to_id).toBe(p.bob);
    expect(triplets.roleOf(pair.id)).toEqual({ kind: 'pair' });
    const wrapper = doublet(triplets, pair.from_id);
    expect(wrapper).toEqual(linkOf(wrapper.id, marker, p.alice));
    expect(triplets.roleOf(wrapper.id)).toEqual({ kind: 'wrapper' });
    expect(triplets.roleOf(10000)).toBe(null);
    expect(triplets.getTriplet(wrapper.id)).toBe(null);
    expect(triplets.getTriplet(0)).toBe(null);
    expect(doublets(triplets).length).toBe(11);
    expectNoOrphans(triplets);
  });

  it('writes zero parts as nothing', () => {
    const triplets = store();
    const p = people(triplets);
    const fromOnly = triplets.createTriplet(p.knows, p.alice, 0);
    const toOnly = triplets.createTriplet(p.knows, 0, p.bob);
    expect(triplets.getTriplet(fromOnly)).toEqual(
      triplet(fromOnly, p.knows, p.alice, 0)
    );
    expect(triplets.getTriplet(toOnly)).toEqual(
      triplet(toOnly, p.knows, 0, p.bob)
    );
    const outer = doublet(triplets, toOnly);
    const pair = doublet(triplets, outer.to_id);
    expect(doublet(triplets, pair.from_id).to_id).toBe(
      triplets.markers.nothing
    );
    expect(triplets.eachTriplet({ type: p.knows, from: 0 })).toEqual([
      triplet(toOnly, p.knows, 0, p.bob),
    ]);
    expect(triplets.eachTriplet({ from: p.alice, to: 0 })).toEqual([
      triplet(fromOnly, p.knows, p.alice, 0),
    ]);
    // Nodes have neither: an empty from finds them as well.
    expect(triplets.countTriplets({ from: 0 })).toBe(7);
    expect(triplets.countTriplets({ to: 0 })).toBe(7);
    expect(triplets.countTriplets({ from: 0, to: 0 })).toBe(6);
  });

  it('gives duplicates their own address', () => {
    const triplets = store();
    const p = people(triplets);
    const size = doublets(triplets).length;
    const first = triplets.createTriplet(p.knows, p.alice, p.bob);
    const second = triplets.createTriplet(p.knows, p.alice, p.bob);
    const third = triplets.createTriplet(p.knows, p.alice, p.bob);
    expect(first === second || second === third).toBe(false);
    const pair = doublet(triplets, first).to_id;
    const duplicate = doublet(triplets, doublet(triplets, second).to_id);
    expect(duplicate).toEqual(linkOf(duplicate.id, pair, second));
    expect(triplets.roleOf(duplicate.id)).toEqual({ kind: 'duplicate-pair' });
    const expected = [first, second, third].map((index) =>
      triplet(index, p.knows, p.alice, p.bob)
    );
    expect(triplets.eachTriplet({ from: p.alice })).toEqual(expected);
    expect(triplets.eachTriplet({ to: p.bob })).toEqual(expected);
    expect(
      triplets.eachTriplet({ type: p.knows, from: p.alice, to: p.bob })
    ).toEqual(expected);
    expect(triplets.countTriplets({ to: p.bob })).toBe(3);

    triplets.deleteTriplet(first);
    expect(triplets.eachTriplet({ from: p.alice })).toEqual(expected.slice(1));
    expectNoOrphans(triplets);
    triplets.deleteTriplet(third);
    triplets.deleteTriplet(second);
    expect(doublets(triplets).length).toBe(size);
    expectNoOrphans(triplets);
  });
});

describe('withTriplets over updates and deletes', () => {
  it('keeps the address through an update and collects the old pair', () => {
    const triplets = store();
    const p = people(triplets);
    const size = doublets(triplets).length;
    const link = triplets.createTriplet(p.knows, p.alice, p.bob);
    const oldPair = doublet(triplets, link).to_id;
    expect(triplets.updateTriplet(link, p.knows, p.alice, p.carol)).toEqual(
      triplet(link, p.knows, p.alice, p.bob)
    );
    expect(triplets.getTriplet(link)).toEqual(
      triplet(link, p.knows, p.alice, p.carol)
    );
    expect(doublet(triplets, oldPair)).toBe(null);
    expect(doublets(triplets).length).toBe(size + 3);

    triplets.updateTriplet(link, p.person, p.bob, p.alice);
    expect(triplets.getTriplet(link)).toEqual(
      triplet(link, p.person, p.bob, p.alice)
    );
    triplets.updateTriplet(link, p.person, 0, 0);
    expect(triplets.getTriplet(link)).toEqual(triplet(link, p.person, 0, 0));
    expect(doublets(triplets).length).toBe(size + 1);
    triplets.updateTriplet(link, link, link, link);
    expect(triplets.getTriplet(link)).toEqual(triplet(link, link, link, link));
    expectNoOrphans(triplets);
    triplets.updateTriplet(link, p.knows, p.alice, p.bob);
    expect(doublets(triplets).length).toBe(size + 3);
    expectNoOrphans(triplets);
    expect(triplets.updateTriplet(link, p.knows, p.alice, p.bob)).toEqual(
      triplet(link, p.knows, p.alice, p.bob)
    );
    expect(triplets.getTriplet(p.person).type).toBe(p.root);
  });

  it('keeps a shared pair while it is used', () => {
    const triplets = store();
    const p = people(triplets);
    const knows = triplets.createTriplet(p.knows, p.alice, p.bob);
    const met = triplets.createTriplet(p.person, p.alice, p.bob);
    const pair = doublet(triplets, knows).to_id;
    expect(doublet(triplets, met).to_id).toBe(pair);
    triplets.updateTriplet(knows, p.knows, p.alice, p.carol);
    expect(doublet(triplets, pair) === null).toBe(false);
    triplets.deleteTriplet(met);
    expect(doublet(triplets, pair)).toBe(null);
    expectNoOrphans(triplets);
    // An update into a slot another triplet holds takes a duplicate pair, and
    // an update out of it collects the duplicate pair.
    const first = triplets.createTriplet(p.knows, p.bob, p.carol);
    const second = triplets.createTriplet(p.person, p.bob, p.carol);
    triplets.updateTriplet(second, p.knows, p.bob, p.carol);
    expect(triplets.roleOf(doublet(triplets, second).to_id)).toEqual({
      kind: 'duplicate-pair',
    });
    expect(triplets.countTriplets({ to: p.carol })).toBe(3);
    triplets.updateTriplet(second, p.person, p.bob, p.carol);
    expect(doublet(triplets, second).to_id).toBe(
      doublet(triplets, first).to_id
    );
    expectNoOrphans(triplets);
  });

  it('cascades a delete to the triplets that use the deleted one', () => {
    const triplets = store();
    const p = people(triplets);
    const size = doublets(triplets).length;
    const ab = triplets.createTriplet(p.knows, p.alice, p.bob);
    const bc = triplets.createTriplet(p.knows, p.bob, p.carol);
    const about = triplets.createTriplet(p.knows, ab, bc);
    expect(triplets.deleteTriplet(p.alice).map(({ index }) => index)).toEqual([
      p.alice,
      ab,
      about,
    ]);
    expect(triplets.isTriplet(bc)).toBe(true);
    expectNoOrphans(triplets);
    // A cycle: two triplets that use each other.
    const first = triplets.createTriplet(p.knows, p.bob, 0);
    const second = triplets.createTriplet(p.knows, first, 0);
    triplets.updateTriplet(first, p.knows, second, 0);
    triplets.deleteTriplet(second);
    expect(doublet(triplets, first)).toBe(null);
    triplets.deleteTriplet(bc);
    expect(doublets(triplets).length).toBe(size - 1);
    expectNoOrphans(triplets);
    // The root takes every triplet with it; only the markers are left.
    triplets.deleteTriplet(p.root);
    expect(doublets(triplets).length).toBe(2);
  });

  it('refuses parts that are not triplets', () => {
    const triplets = store();
    const p = people(triplets);
    const { pair: marker, nothing } = triplets.markers;
    const link = triplets.createTriplet(p.knows, p.alice, p.bob);
    const pair = doublet(triplets, link).to_id;
    const refusals = [
      [() => triplets.createTriplet(0), 'The type of a triplet cannot be 0.'],
      [
        () => triplets.createTriplet(marker),
        `The type ${marker} is not a triplet.`,
      ],
      [
        () => triplets.createTriplet(pair),
        `The type ${pair} is not a triplet.`,
      ],
      [
        () => triplets.createTriplet(p.knows, 10000),
        'The from part 10000 is not a triplet.',
      ],
      [
        () => triplets.createTriplet(p.knows, 0, nothing),
        `The to part ${nothing} is not a triplet.`,
      ],
      [
        () => triplets.updateTriplet(pair, p.knows),
        `Link ${pair} is not a triplet.`,
      ],
      [
        () => triplets.updateTriplet(link, 0),
        'The type of a triplet cannot be 0.',
      ],
      [() => triplets.deleteTriplet(pair), `Link ${pair} is not a triplet.`],
      [() => triplets.deleteTriplet(10000), 'Link 10000 is not a triplet.'],
    ];
    for (const [refused, message] of refusals) {
      expect(refused).toThrow(message);
    }
    expect(triplets.getTriplet(link)).toEqual(
      triplet(link, p.knows, p.alice, p.bob)
    );
  });
});

/** The same pseudo-random sequence as link-cli's tests: a 64-bit LCG. */
function createRandom(seed) {
  let state = BigInt(seed);
  return (bound) => {
    state = BigInt.asUintN(
      64,
      state * 6364136223846793005n + 1442695040888963407n
    );
    return Number((state >> 33n) % BigInt(bound));
  };
}

/** A triplet store kept in a map: what the decorator must agree with. */
function createReference() {
  const stored = new Map();
  return {
    stored,
    each: (query = {}) =>
      [...stored.entries()]
        .sort(([a], [b]) => a - b)
        .map(([index, [type, from, to]]) => triplet(index, type, from, to))
        .filter((t) =>
          Object.entries(query).every(([part, value]) => t[part] === value)
        ),
    delete(index) {
      const pending = [index];
      while (pending.length > 0) {
        const deleted = pending.pop();
        if (stored.delete(deleted)) {
          for (const [user, parts] of stored) {
            if (parts.includes(deleted)) {
              pending.push(user);
            }
          }
        }
      }
    },
  };
}

describe('withTriplets against a triplet store', () => {
  it('agrees on a thousand triplets', () => {
    const triplets = store();
    const reference = createReference();
    const { stored } = reference;
    const random = createRandom(151);
    const idsOf = () => [...stored.keys()].sort((a, b) => a - b);
    const part = (ids) => (random(4) === 0 ? 0 : ids[random(ids.length)]);
    const root = triplets.createTripletPoint();
    stored.set(root, [root, 0, 0]);
    const protectedIds = new Set([root]);
    for (let at = 0; at < 10; at++) {
      const type = triplets.createTriplet(root, 0, 0);
      stored.set(type, [root, 0, 0]);
      protectedIds.add(type);
    }
    const counts = { creates: 0, updates: 0, deletes: 0 };
    const pick = (ids) => ids[random(ids.length)];
    const create = (ids) => {
      const parts = [pick(ids), part(ids), part(ids)];
      const index = triplets.createTriplet(...parts);
      expect(stored.has(index)).toBe(false);
      stored.set(index, parts);
      counts.creates++;
    };
    const update = (index, ids) => {
      const parts = [pick(ids), part(ids), part(ids)];
      triplets.updateTriplet(index, ...parts);
      stored.set(index, parts);
      counts.updates++;
    };
    const remove = (index) => {
      const deleted = triplets.deleteTriplet(index);
      const before = stored.size;
      reference.delete(index);
      expect(deleted.length).toBe(before - stored.size);
      counts.deletes++;
    };
    for (let step = 0; step < 1600 || stored.size < 1000; step++) {
      const ids = idsOf();
      const choice = step >= 1600 ? 0 : random(10);
      if (choice <= 6) {
        create(ids);
      } else {
        const index = pick(ids);
        if (!protectedIds.has(index)) {
          if (choice <= 8) {
            update(index, ids);
          } else {
            remove(index);
          }
        }
      }
    }
    expect(
      counts.creates > 1000 && counts.updates > 100 && counts.deletes > 50
    ).toBe(true);
    expect(stored.size >= 1000).toBe(true);

    expect(triplets.eachTriplet()).toEqual(reference.each());
    const ids = idsOf();
    for (const id of [...ids, 0]) {
      for (const query of [
        { type: id },
        { from: id },
        { to: id },
        { index: id },
      ]) {
        expect(triplets.eachTriplet(query)).toEqual(reference.each(query));
      }
    }
    for (let at = 0; at < 200; at++) {
      const query = { type: part(ids), from: part(ids), to: part(ids) };
      expect(triplets.eachTriplet(query)).toEqual(reference.each(query));
      const [type, from, to] = stored.get(ids[random(ids.length)]);
      for (const narrower of [
        { type, from },
        { type, to },
        { from, to },
        { type, from, to },
      ]) {
        expect(triplets.eachTriplet(narrower)).toEqual(
          reference.each(narrower)
        );
      }
    }
    expectNoOrphans(triplets);

    while (stored.size > 0) {
      const [index] = idsOf();
      triplets.deleteTriplet(index);
      reference.delete(index);
      expect(triplets.countTriplets()).toBe(stored.size);
    }
    expect(doublets(triplets).length).toBe(2);
  });
});

const PEOPLE = `(() (
  (Type: Type 0 0)
  (Person: Type 0 0)
  (knows: Type 0 0)
  (alice: Person 0 0)
  (bob: Person 0 0)
  (carol: Person 0 0)
  (r: knows alice bob)
))`;

function namedPeople() {
  const links = createMemoryLinks();
  const names = createNames();
  const triplets = withTriplets(links, { names });
  const id = (name) => names.getByName(name);
  const run = (text) => {
    const changes = runQuery({ links: triplets, names }, text);
    expectNoOrphans(triplets);
    return changes;
  };
  run(PEOPLE);
  const named = (index, type, from, to) =>
    triplet(id(index), id(type), id(from), id(to));
  return { triplets, names, id, named, run };
}

describe('runQuery with three-part links', () => {
  it('updates the to part in place', () => {
    const { triplets, named, run } = namedPeople();
    const before = named('r', 'knows', 'alice', 'bob');
    const after = named('r', 'knows', 'alice', 'carol');
    const text = (t) => `(${t.index}: ${t.type} ${t.from} ${t.to})`;
    expect(run(`((${text(before)}) (${text(after)}))`)).toEqual([
      { before, after },
    ]);
    expect(triplets.getTriplet(before.index)).toEqual(after);
    // And by name, with a variable.
    const changes = run('((($r: knows alice carol)) (($r: knows alice bob)))');
    expect(changes[0].after).toEqual(before);
  });

  it('reads, creates and deletes', () => {
    const { triplets, id, named, run } = namedPeople();
    const r = named('r', 'knows', 'alice', 'bob');
    expect(run('((($i: knows $f $t)) (($i: knows $f $t)))')).toEqual([
      { before: r, after: r },
    ]);
    expect(run('((($p: Person 0 0)) (($p: Person 0 0)))').length).toBe(3);

    // A create for every match, with the variable of the match.
    const created = run(
      '((($p: Person 0 0)) (($p: Person 0 0) (knows $p bob)))'
    );
    expect(created.filter(({ before }) => before === null).length).toBe(3);
    expect(triplets.countTriplets({ to: id('bob') })).toBe(4);

    // No restriction: a create; a new name is a new triplet.
    const changes = run('(() ((likes: Type 0 0) (likes carol alice)))');
    expect(changes.length).toBe(2);
    expect(changes.every(({ before }) => before === null)).toBe(true);
    expect(triplets.countTriplets({ type: id('likes') })).toBe(1);

    // No substitution: a delete, with whatever used the deleted triplet.
    const deleted = run('((($i: knows $p bob)) ())');
    expect(deleted.length).toBe(4);
    expect(deleted.every(({ after }) => after === null)).toBe(true);
    expect(triplets.countTriplets({ to: id('bob') })).toBe(0);
    expect(triplets.isTriplet(r.index)).toBe(false);
  });

  it('changes the type part, keeps a part with * and joins patterns', () => {
    const { named, run } = namedPeople();
    run('(() ((likes: Type 0 0)))');
    const changes = run('((($i: knows $f $t)) (($i: likes $f $t)))');
    expect(changes[0].after).toEqual(named('r', 'likes', 'alice', 'bob'));
    const swapped = run('((($i: likes $f $t)) (($i: * $t $f)))');
    expect(swapped[0].after).toEqual(named('r', 'likes', 'bob', 'alice'));
    const both = run(
      '((($i: likes $f $t) ($f: Person 0 0)) (($i: likes $f $t) ($f: Person 0 0)))'
    );
    expect(both.length).toBe(2);
  });

  it('refuses unknown references, leaving everything as it was', () => {
    const { triplets, run, names } = namedPeople();
    const before = doublets(triplets);
    const refusals = [
      ['(() ((nobody alice bob)))', 'The type part nobody'],
      ['(() ((knows $x bob)))', 'The from part $x'],
      ['(() ((knows * bob)))', 'The from part *'],
      [
        '(() ((*: knows alice bob)))',
        'A substitution cannot create or update the index *.',
      ],
      [
        '(() ((knows alice)))',
        'A triplet pattern has three parts, type, from and to: (knows alice) has 2.',
      ],
      ['(() ((0 alice bob)))', 'The type part 0'],
      ['((($i: knows $f $t)) (($i: knows $f $nobody)))', 'The to part $nobody'],
      ['(a b c)', 'A triplets query is ((restriction) (substitution)).'],
      ['(() (0: 1 2 3))', 'A triplet cannot be at address 0.'],
      [
        '(() ((knows (a b) bob)))',
        'A part of a triplet pattern is a reference, not (a b).',
      ],
    ];
    for (const [text, message] of refusals) {
      expect(() => runQuery({ links: triplets, names }, text)).toThrow(message);
    }
    expect(doublets(triplets)).toEqual(before);
    // A restriction by an unknown name matches nothing.
    expect(run('((($i: nobody $f $t)) ())')).toEqual([]);
  });

  it('undoes everything when a later pattern fails', () => {
    const { triplets, names, id } = namedPeople();
    const before = doublets(triplets);
    // The last pattern merges nothing, yet refers to a doublet.
    const pair = doublet(triplets, id('r')).to_id;
    expect(() =>
      runQuery(
        { links: triplets, names },
        `(() ((extra: Type 0 0) (${pair}: knows alice bob)))`
      )
    ).toThrow(`Link ${pair} is a doublet, not a triplet.`);
    expect(doublets(triplets)).toEqual(before);
    expect(names.getByName('extra')).toBe(null);
  });

  it('runs over the view alone, its names being those of the markers', () => {
    const triplets = store();
    const changes = runQuery({ links: triplets }, '(() ((Root: Root 0 0)))');
    expect(changes.length).toBe(1);
    expect(triplets.names.getByName('Root')).toBe(changes[0].after.index);
  });
});

describe('a doublet of somebody else', () => {
  it('is foreign, and is not mistaken for a triplet', () => {
    const triplets = store();
    const { root } = people(triplets);
    const plain = triplets.create();
    expect(triplets.roleOf(plain)).toEqual({ kind: 'foreign' });
    expect(triplets.getTriplet(plain)).toBe(null);
    expect(triplets.eachTriplet({ index: plain })).toEqual([]);
    expect(() => triplets.createTriplet(plain)).toThrow(
      `The type ${plain} is not a triplet.`
    );
    expect(triplets.countTriplets({ type: root })).toBe(3);
    expectNoOrphans(triplets, { foreign: true });
  });
});
