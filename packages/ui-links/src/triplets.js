/**
 * Triplets `(index: type from to)` stored in the doublets of any storage: the
 * encoding of link-cli (`docs/TRIPLETS.md`), so a store written by one reads
 * the same in the other. The type of a link is its source, and two marker
 * points are added, `Pair` (`P`) and `Nothing` (`N`, the empty part `0`):
 *
 *   (i: T 0 0)     (i: T i)
 *   (i: T f t)     wrapper w = (P f), pair p = (w t), outer (i: T p)
 *   the same again the outer (T p) is taken: duplicate d = (p i), (i: T d)
 *
 * A zero `f` or `t` is written as `N`. Wrappers and pairs are shared by the
 * triplets with the same parts and collected as soon as nothing uses them. A
 * triplet keeps its address through updates. Deleting a triplet deletes every
 * triplet that uses it as its type, from or to.
 *
 * `withTriplets` keeps the doublets interface (`create`, `update`, `delete`,
 * `count`, `each` read and write the doublets underneath) and adds the triplet
 * calls, whose names end in `Triplet`, so it stacks with every other layer.
 */

import { ANY, NULL } from './constants.js';
import { deleteCascade } from './decorators.js';
import {
  allLinks,
  decorate,
  ensureCreated,
  exists,
  getLink,
  LinksError,
  linkOf,
  notFound,
  search,
} from './links.js';
import { createLinksNames } from './links-names.js';
import { forbidden, withPermissions } from './permissions.js';
import { point } from './types.js';

/**
 * @typedef {{ index: number, type: number, from: number, to: number }} Triplet
 * @typedef {{ pair: number, nothing: number }} TripletMarkers
 */

const refused = (message) => new LinksError('bad-request', message);

/**
 * The markers of the encoding: the points named `Pair` and `Nothing`, created
 * when missing.
 * @returns {TripletMarkers}
 */
export const tripletMarkers = (links, names) => ({
  pair: point(links, names, 'Pair'),
  nothing: point(links, names, 'Nothing'),
});

/** A restriction: `{ index, type, from, to }` or `[index, type, from, to]`. */
function queryOf(query) {
  const [index, type, from, to] = Array.isArray(query)
    ? query
    : [query?.index, query?.type, query?.from, query?.to];
  const part = (value) => (value === undefined || value === ANY ? null : value);
  return {
    index: part(index),
    type: part(type),
    from: part(from),
    to: part(to),
  };
}

/** Whether `triplet` satisfies every part of the restriction `query`. */
export function matchesTriplet(triplet, query) {
  const { index, type, from, to } = queryOf(query);
  return (
    (index === null || index === triplet.index) &&
    (type === null || type === triplet.type) &&
    (from === null || from === triplet.from) &&
    (to === null || to === triplet.to)
  );
}

const byIndex = (found) =>
  [...new Map(found.map((t) => [t.index, t])).values()].sort(
    (a, b) => a.index - b.index
  );

const isAuxiliary = ({ kind }) =>
  kind === 'wrapper' || kind === 'pair' || kind === 'duplicate-pair';
const leadsOn = ({ kind }) => kind === 'pair' || kind === 'duplicate-pair';

/** What deleting `first` deletes, `first` first: it and what uses it. */
export function cascadeOf(triplets, first) {
  const deleted = [first];
  const seen = new Set([first.index]);
  for (let at = 0; at < deleted.length; at++) {
    const used = deleted[at].index;
    const users = byIndex(
      [{ type: used }, { from: used }, { to: used }].flatMap((query) =>
        triplets.eachTriplet(query)
      )
    );
    for (const user of users) {
      if (!seen.has(user.index)) {
        seen.add(user.index);
        deleted.push(user);
      }
    }
  }
  return deleted;
}

function ensureType(triplets, type, itself) {
  if (type === NULL) {
    throw refused('The type of a triplet cannot be 0.');
  }
  if (type !== itself && !triplets.isTriplet(type)) {
    throw refused(`The type ${type} is not a triplet.`);
  }
}

function ensurePart(triplets, part, itself, name) {
  if (part !== NULL && part !== itself && !triplets.isTriplet(part)) {
    throw refused(`The ${name} part ${part} is not a triplet.`);
  }
}

const notATriplet = (index) => refused(`Link ${index} is not a triplet.`);

/** Reading the encoding: what a doublet is, and the triplets it holds. */
function createTripletReader(links, markers) {
  const isMarker = (id) => id === markers.pair || id === markers.nothing;
  const encode = (part) => (part === NULL ? markers.nothing : part);
  const decode = (part) => (part === markers.nothing ? NULL : part);
  const stored = (id) => (id === NULL ? null : getLink(links, id));

  const isWrapper = (id) =>
    id !== NULL && !isMarker(id) && stored(id)?.from_id === markers.pair;
  const isPair = (id) => {
    if (id === NULL || isMarker(id)) {
      return false;
    }
    const link = stored(id);
    return link !== null && isWrapper(link.from_id);
  };

  /** The triplet of `link` with the parts of the pair `pair`, if it has them. */
  const tripletOn = (link, pair) => {
    const wrapper = stored(pair.from_id);
    return (
      wrapper && {
        kind: 'triplet',
        triplet: {
          index: link.id,
          type: link.from_id,
          from: decode(wrapper.to_id),
          to: decode(pair.to_id),
        },
      }
    );
  };

  /** What a doublet is by its source: made on a pair, or nothing yet. */
  const roleBySource = (source) => {
    if (source.from_id === markers.pair) {
      return { kind: 'pair' };
    }
    if (isWrapper(source.from_id)) {
      return { kind: 'duplicate-pair' };
    }
    // The source is a duplicate pair: nothing of ours has one.
    return isPair(source.from_id) ? { kind: 'foreign' } : null;
  };

  /** What a doublet is that is neither a marker nor made on a pair. */
  const roleByTarget = (link) => {
    if (link.to_id === link.id) {
      return {
        kind: 'triplet',
        triplet: { index: link.id, type: link.from_id, from: 0, to: 0 },
      };
    }
    const foreign = { kind: 'foreign' };
    const target = stored(link.to_id);
    if (target === null || isMarker(target.id)) {
      return foreign;
    }
    if (isWrapper(target.from_id)) {
      return tripletOn(link, target) ?? foreign;
    }
    if (target.to_id === link.id && isPair(target.from_id)) {
      const pair = stored(target.from_id);
      return (pair && tripletOn(link, pair)) ?? foreign;
    }
    return foreign;
  };

  /** What `link` is in the encoding, by its sources alone. */
  const role = (link) => {
    if (isMarker(link.id)) {
      return { kind: 'marker' };
    }
    if (link.from_id === markers.pair) {
      return { kind: 'wrapper' };
    }
    const source =
      link.from_id === markers.nothing ? null : stored(link.from_id);
    if (source === null) {
      return { kind: 'foreign' };
    }
    return roleBySource(source) ?? roleByTarget(link);
  };

  const tripletOf = (link) => {
    const found = role(link);
    return found.kind === 'triplet' ? found.triplet : null;
  };

  /** The triplets on `pair`: outers `(T pair)` and duplicates `(pair i)`. */
  const tripletsOnPair = (pair) => {
    const found = allLinks(links, { to_id: pair }).map(tripletOf);
    for (const duplicate of allLinks(links, { from_id: pair })) {
      const outer = stored(duplicate.to_id);
      if (outer?.to_id === duplicate.id) {
        found.push(tripletOf(outer));
      }
    }
    return found.filter((triplet) => triplet !== null);
  };

  /** The triplets with `from` or `to` set, or `null` when neither says. */
  const candidatesOnParts = (from, to) => {
    if (from !== null && to !== null && (from !== NULL || to !== NULL)) {
      const wrapper = search(links, markers.pair, encode(from));
      const pair = wrapper && search(links, wrapper.id, encode(to));
      return pair ? tripletsOnPair(pair.id) : [];
    }
    if (from !== null && from !== NULL) {
      const wrapper = search(links, markers.pair, from);
      return wrapper
        ? allLinks(links, { from_id: wrapper.id }).flatMap((pair) =>
            tripletsOnPair(pair.id)
          )
        : [];
    }
    if (to !== null && to !== NULL) {
      return allLinks(links, { to_id: to })
        .filter((pair) => isWrapper(pair.from_id))
        .flatMap((pair) => tripletsOnPair(pair.id));
    }
    return null;
  };

  /** The triplets a restriction reaches without reading every doublet. */
  const candidatesOf = ({ index, type, from, to }) => {
    if (index !== null) {
      const link = stored(index);
      const found = link && tripletOf(link);
      return found ? [found] : [];
    }
    const onParts = candidatesOnParts(from, to);
    if (onParts !== null) {
      return onParts;
    }
    const everything =
      type === null
        ? allLinks(links)
        : type !== NULL && !isMarker(type)
          ? allLinks(links, { from_id: type })
          : [];
    return everything.map(tripletOf).filter((triplet) => triplet !== null);
  };

  return { isMarker, encode, stored, role, tripletOf, candidatesOf };
}

/** Writing the encoding: the doublets a triplet needs, and collecting them. */
function createTripletWriter(links, markers, { encode, stored, role }) {
  /** The doublet `(source target)`, created when missing. */
  const getOrCreate = (source, target) => {
    const found = search(links, source, target);
    if (found !== null) {
      return found.id;
    }
    const id = links.create();
    links.update(id, source, target);
    return id;
  };

  const pairOf = (from, to) =>
    getOrCreate(getOrCreate(markers.pair, encode(from)), encode(to));

  /** Writes the outer doublet, which must not merge into another one. */
  const setOuter = (index, source, target) => {
    const link = stored(index);
    if (link?.from_id === source && link?.to_id === target) {
      return;
    }
    const existing = search(links, source, target);
    if (existing !== null && existing.id !== index) {
      throw refused(
        `The doublet (${source} ${target}) is already ${existing.id}: triplet ${index} would be merged into it.`
      );
    }
    links.update(index, source, target);
  };

  const usages = (id) =>
    [{ from_id: id }, { to_id: id }]
      .map(
        (query) =>
          allLinks(links, query).filter((link) => link.id !== id).length
      )
      .reduce((a, b) => a + b);

  /**
   * Deletes each wrapper or pair of `candidates` nothing uses, then what it
   * was made of, as long as nothing else uses that either. A candidate already
   * gone leads on to what it was made of.
   */
  const collect = (candidates) => {
    const pending = [];
    for (const { link, role: was } of candidates) {
      if (exists(links, link.id)) {
        pending.push(link.id);
      } else if (leadsOn(was)) {
        pending.push(link.from_id);
      }
    }
    while (pending.length > 0) {
      const id = pending.pop();
      const link = stored(id);
      if (link === null) {
        continue;
      }
      const found = role(link);
      if (isAuxiliary(found) && usages(id) === 0) {
        links.delete(id);
        if (leadsOn(found)) {
          pending.push(link.from_id);
        }
      }
    }
  };

  return { getOrCreate, pairOf, setOuter, usages, collect };
}

/**
 * Triplets over the doublets of `links`.
 * @param {any} links  any storage, or a layer over one
 * @param {object} [options]
 * @param {any} [options.names]  the names store of the markers; by default the
 *   names are kept as doublets of `links`, so they persist with the data
 * @param {TripletMarkers} [options.markers]  the markers, when already known
 */
export function withTriplets(links, options = {}) {
  const names = options.names ?? createLinksNames(links);
  const markers = options.markers ?? tripletMarkers(links, names);
  const reader = createTripletReader(links, markers);
  const { stored, role, tripletOf, candidatesOf } = reader;
  const { getOrCreate, pairOf, setOuter, usages, collect } =
    createTripletWriter(links, markers, reader);

  const view = decorate(links, {
    markers,
    names,
    /** The storage under this view. */
    doublets: links,
    /** The same view over another layer of the same storage. */
    over: (other) =>
      withTriplets(other, {
        markers,
        names: names.withLinks?.(other) ?? names,
      }),
    /**
     * What the doublet `id` is: `{ kind }`, one of `marker`, `wrapper`, `pair`,
     * `duplicate-pair`, `foreign` or `triplet` (with `triplet`); `null` when
     * there is none.
     */
    roleOf(id) {
      const link = stored(id);
      return link && role(link);
    },
    /** @returns {Triplet | null} */
    getTriplet(index) {
      const link = stored(index);
      return link && tripletOf(link);
    },
    isTriplet: (index) => view.getTriplet(index) !== null,
    /**
     * Creates `(i: type from to)` and returns `i`. `type` must be a triplet;
     * `from` and `to` must be triplets or 0.
     */
    createTriplet(type, from = NULL, to = NULL) {
      ensureType(view, type, null);
      ensurePart(view, from, null, 'from');
      ensurePart(view, to, null, 'to');
      const create = (target) => {
        const index = links.create();
        setOuter(index, type, target(index));
        return index;
      };
      if (from === NULL && to === NULL) {
        return create((index) => index);
      }
      const pair = pairOf(from, to);
      return search(links, type, pair) === null
        ? create(() => pair)
        : create((index) => getOrCreate(pair, index));
    },
    /** Creates a point `(i: i 0 0)`, a triplet that is its own type. */
    createTripletPoint() {
      const index = links.create();
      links.update(index, index, index);
      return index;
    },
    /** Creates the point `(address: address 0 0)` at an unused address. */
    createTripletPointAt(address) {
      ensureCreated(links, address);
      links.update(address, address, address);
    },
    /**
     * Makes the triplet at `index` `(index: type from to)`, keeping its
     * address, and returns it as it was. `type`, `from` and `to` may be `index`.
     * @returns {Triplet}
     */
    updateTriplet(index, type, from = NULL, to = NULL) {
      const before = view.getTriplet(index);
      if (before === null) {
        throw notATriplet(index);
      }
      ensureType(view, type, index);
      ensurePart(view, from, index, 'from');
      ensurePart(view, to, index, 'to');
      if (before.type === type && before.from === from && before.to === to) {
        return before;
      }
      const oldTarget = stored(index).to_id;
      let newTarget = index;
      if (from !== NULL || to !== NULL) {
        const pair = pairOf(from, to);
        const taken = search(links, type, pair);
        newTarget =
          taken === null || taken.id === index
            ? pair
            : getOrCreate(pair, index);
      }
      setOuter(index, type, newTarget);
      if (oldTarget !== newTarget && oldTarget !== index) {
        const old = stored(oldTarget);
        collect(old ? [{ link: old, role: role(old) }] : []);
      }
      return before;
    },
    /**
     * Deletes the triplet at `index` and every triplet that uses a deleted
     * one; returns them all, `index` first. Nothing of them is left behind.
     * @returns {Triplet[]}
     */
    deleteTriplet(index) {
      const first = view.getTriplet(index);
      if (first === null) {
        throw notATriplet(index);
      }
      const deleted = cascadeOf(view, first);
      // As they are now: a delete below may take some along, and their
      // sources must still be collected.
      const auxiliary = deleted
        .flatMap((triplet) => [
          ...allLinks(links, { to_id: triplet.index }),
          ...[stored(stored(triplet.index).to_id)].filter(Boolean),
        ])
        .map((link) => ({ link, role: role(link) }))
        .filter(({ role: found }) => isAuxiliary(found));
      // Users go first; what still uses a triplet (a cycle, a doublet of
      // somebody else) goes with it.
      for (const { index: id } of [...deleted].reverse()) {
        if (exists(links, id)) {
          deleteCascade(links, id);
        }
      }
      collect(auxiliary);
      return deleted;
    },
    /**
     * The triplets that match the restriction, by address; a part left out
     * matches anything, `0` an empty `from` or `to`.
     * @param {any} [query]  `{ index, type, from, to }` or an array of them
     * @returns {Triplet[]}
     */
    eachTriplet(query) {
      const restriction = queryOf(query);
      return byIndex(
        candidatesOf(restriction).filter((triplet) =>
          matchesTriplet(triplet, query)
        )
      );
    },
    countTriplets: (query) => view.eachTriplet(query).length,
    /** How many other doublets use the doublet `id`. */
    doubletUsages: usages,
  });
  return view;
}

/**
 * The triplets as `subject` sees them, judged on the outer doublet of each
 * triplet by the same policy as links: the wrappers and pairs that store its
 * parts are not the subject's business, which is why this goes above
 * `withTriplets`, not below it.
 *
 * What the subject may not read is not a triplet to it. Creating needs the
 * right to create and to write the type; updating, to write the triplet as it
 * is and as it will be; deleting, to write every triplet the delete takes
 * along. A point the subject created, still only its own type, is its own.
 *
 * The doublets interface of the result is `withPermissions` over the doublets.
 * @param {ReturnType<typeof withTriplets>} triplets
 * @param {ReturnType<typeof import('./permissions.js').createPolicy>} policy
 * @param {number | null | (() => number | null)} subject
 * @param {Set<number>} [created]  the addresses the subject created
 */
export function withTripletPermissions(
  triplets,
  policy,
  subject,
  created = new Set()
) {
  const who = typeof subject === 'function' ? subject : () => subject;
  const owns = (link) =>
    link.from_id === link.id && link.to_id === link.id && created.has(link.id);
  const doublets = withPermissions(triplets.doublets, policy, who, {
    created,
    owns,
  });
  const outerOf = (index) => getLink(triplets.doublets, index);
  const readable = (link) =>
    link !== null && (owns(link) || policy.canRead(who(), link));
  const writable = (link) =>
    link !== null && (owns(link) || policy.canWrite(who(), link));
  const canCreate = () => {
    if (!policy.canCreate(who())) {
      throw forbidden('create');
    }
  };
  const view = decorate(doublets, {
    markers: triplets.markers,
    names: triplets.names,
    doublets: triplets.doublets,
    canReference: doublets.canReference,
    forget: doublets.forget,
    readable,
    over: (other) =>
      withTripletPermissions(triplets.over(other), policy, who, created),
    roleOf: (id) => (readable(outerOf(id)) ? triplets.roleOf(id) : null),
    getTriplet: (index) =>
      readable(outerOf(index)) ? triplets.getTriplet(index) : null,
    isTriplet: (index) => view.getTriplet(index) !== null,
    createTriplet(type, from = NULL, to = NULL) {
      canCreate();
      // A subject that may write a type need not read it: the layer below
      // judges that the type exists.
      if (type !== NULL && !policy.canWrite(who(), linkOf(NULL, type, NULL))) {
        throw forbidden('create');
      }
      ensurePart(view, from, null, 'from');
      ensurePart(view, to, null, 'to');
      const index = triplets.createTriplet(type, from, to);
      created.add(index);
      return index;
    },
    createTripletPoint() {
      canCreate();
      const index = triplets.createTripletPoint();
      created.add(index);
      return index;
    },
    createTripletPointAt(address) {
      canCreate();
      // A hidden link is not found, yet its address is taken.
      if (exists(triplets.doublets, address)) {
        throw notFound(address);
      }
      triplets.createTripletPointAt(address);
      created.add(address);
    },
    updateTriplet(index, type, from = NULL, to = NULL) {
      if (view.getTriplet(index) === null) {
        throw notATriplet(index);
      }
      // Only an empty triplet has itself as its target.
      const target = from === NULL && to === NULL ? index : NULL;
      if (!writable(outerOf(index)) || !writable(linkOf(index, type, target))) {
        throw forbidden(`update ${index}`);
      }
      ensurePart(view, from, index, 'from');
      ensurePart(view, to, index, 'to');
      return triplets.updateTriplet(index, type, from, to);
    },
    deleteTriplet(index) {
      const first = view.getTriplet(index);
      if (first === null) {
        throw notATriplet(index);
      }
      for (const { index: id } of cascadeOf(triplets, first)) {
        if (!writable(outerOf(id))) {
          throw forbidden(`delete ${index}`);
        }
      }
      const deleted = triplets.deleteTriplet(index);
      deleted.forEach((triplet) => created.delete(triplet.index));
      return deleted;
    },
    eachTriplet: (query) =>
      triplets
        .eachTriplet(query)
        .filter((triplet) => readable(outerOf(triplet.index))),
    countTriplets: (query) => view.eachTriplet(query).length,
    doubletUsages: triplets.doubletUsages,
  });
  return view;
}
