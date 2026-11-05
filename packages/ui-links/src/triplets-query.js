/**
 * Substitution queries over triplets, `((restriction) (substitution))`, where
 * every pattern has three parts, `(index: type from to)` or `(type from to)`:
 *
 * - a restriction pattern matches triplets; the patterns are a conjunction over
 *   their variables (`$name`), and `*` matches anything;
 * - a substitution pattern whose index is a matched triplet updates it, keeping
 *   its address; `*` in a part keeps that part;
 * - a matched triplet no substitution pattern names is deleted, with the
 *   triplets that use it;
 * - any other substitution pattern creates a triplet: at its address, under its
 *   name, bound to its variable, or anywhere when it has no index.
 *
 * A query whose substitution repeats its restriction only reads. The port of
 * link-cli's `rust/src/triplets/query.rs`, with the same messages.
 */

import { MAX_ADDRESS } from './constants.js';
import { exists, LinksError } from './links.js';

/** A LiNo value as one shape: a reference is a link without values. */
const linkOf = (value) =>
  typeof value === 'string' ? { id: value, values: [] } : value;
const hasValues = (value) => linkOf(value).values.length > 0;

function describe(value) {
  const { id, values } = linkOf(value);
  const parts = values.map(describe).join(' ');
  if (id === null) {
    return `(${parts})`;
  }
  return values.length > 0 ? `(${id}: ${parts})` : id;
}

const refused = (message) => new LinksError('bad-request', message);

const ANY_PART = { kind: 'any' };

function referenceOf(text) {
  if (text === '*') {
    return ANY_PART;
  }
  if (text.startsWith('$')) {
    return { kind: 'variable', name: text };
  }
  const address = Number(text);
  return [...text].every((digit) => digit >= '0' && digit <= '9') &&
    address <= MAX_ADDRESS
    ? { kind: 'address', address }
    : { kind: 'name', name: text };
}

/** The pattern `(index: type from to)` or `(type from to)`. */
function patternOf(value) {
  const { id, values } = linkOf(value);
  if (values.length !== 3) {
    throw refused(
      `A triplet pattern has three parts, type, from and to: ${describe(value)} has ${values.length}.`
    );
  }
  return {
    index: id === null ? null : referenceOf(id),
    parts: values.map((part) => {
      const { id: reference } = linkOf(part);
      if (reference === null || hasValues(part)) {
        throw refused(
          `A part of a triplet pattern is a reference, not ${describe(part)}.`
        );
      }
      return referenceOf(reference);
    }),
  };
}

/** One side: `()` has no patterns, `(i: T f t)` one, `((…) (…))` a list. */
function patternsOf(side) {
  const { id, values } = linkOf(side);
  return id !== null || values.some((value) => !hasValues(value))
    ? [patternOf(side)]
    : values.map(patternOf);
}

function sidesOf(document) {
  if (document.length === 2) {
    return document;
  }
  const [only] = document;
  if (
    document.length === 1 &&
    typeof only !== 'string' &&
    only.id === null &&
    only.values.length === 2
  ) {
    return only.values;
  }
  throw refused('A triplets query is ((restriction) (substitution)).');
}

const describeReference = (reference) =>
  reference.kind === 'any'
    ? '*'
    : reference.kind === 'address'
      ? String(reference.address)
      : reference.name;

const nameOf = (names, name) => {
  const id = names?.getByName(name) ?? null;
  return id === 0 ? null : id;
};

/** A reference as a restriction: `null` any value, `undefined` impossible. */
function restrictionOf(names, reference, bindings) {
  switch (reference.kind) {
    case 'any':
      return null;
    case 'variable':
      return bindings.get(reference.name) ?? null;
    case 'address':
      return reference.address;
    default:
      return nameOf(names, reference.name) ?? undefined;
  }
}

function bind(bindings, reference, value) {
  if (reference.kind !== 'variable') {
    return true;
  }
  const bound = bindings.get(reference.name);
  if (bound !== undefined) {
    return bound === value;
  }
  bindings.set(reference.name, value);
  return true;
}

/** Every assignment under which each pattern matches a triplet. */
function solve(triplets, names, patterns, bindings, matched, solutions) {
  const [pattern, ...rest] = patterns;
  if (pattern === undefined) {
    solutions.push({ bindings, matched: [...matched] });
    return;
  }
  const references = [pattern.index ?? ANY_PART, ...pattern.parts];
  const query = references.map((reference) =>
    restrictionOf(names, reference, bindings)
  );
  if (query.includes(undefined)) {
    return;
  }
  const [index, type, from, to] = query;
  for (const triplet of triplets.eachTriplet({ index, type, from, to })) {
    const next = new Map(bindings);
    const found = [triplet.index, triplet.type, triplet.from, triplet.to];
    if (references.every((reference, at) => bind(next, reference, found[at]))) {
      matched.push(triplet.index);
      solve(triplets, names, rest, next, matched, solutions);
      matched.pop();
    }
  }
}

/** What each substitution pattern writes to; refuses a bad index. */
function targetsOf(triplets, names, patterns, bindings, defined) {
  return patterns.map(({ index: reference }) => {
    if (reference === null) {
      return { kind: 'new', reference: null };
    }
    if (reference.kind === 'any') {
      throw refused('A substitution cannot create or update the index *.');
    }
    if (reference.kind === 'address') {
      const { address } = reference;
      if (address === 0) {
        throw refused('A triplet cannot be at address 0.');
      }
      if (triplets.isTriplet(address)) {
        return { kind: 'existing', index: address };
      }
      if (exists(triplets.doublets, address)) {
        throw refused(`Link ${address} is a doublet, not a triplet.`);
      }
      defined.addresses.add(address);
      return { kind: 'address', address };
    }
    const known =
      reference.kind === 'variable'
        ? (bindings.get(reference.name) ?? null)
        : nameOf(names, reference.name);
    if (known === null) {
      defined[reference.kind === 'variable' ? 'variables' : 'names'].add(
        reference.name
      );
      return { kind: 'new', reference };
    }
    if (!triplets.isTriplet(known)) {
      throw refused(`Link ${known} is not a triplet.`);
    }
    return { kind: 'existing', index: known };
  });
}

/** Every reference of the parts is checked before anything is written. */
function checkParts(triplets, names, patterns, targets, bindings, defined) {
  const isKnown = (part, position, target) => {
    switch (part.kind) {
      case 'any':
        return target.kind === 'existing';
      case 'variable':
        return bindings.has(part.name) || defined.variables.has(part.name);
      case 'name':
        return (
          nameOf(names, part.name) !== null || defined.names.has(part.name)
        );
      default:
        return part.address === 0
          ? position > 0
          : triplets.isTriplet(part.address) ||
              defined.addresses.has(part.address);
    }
  };
  patterns.forEach(({ parts }, at) =>
    parts.forEach((part, position) => {
      if (!isKnown(part, position, targets[at])) {
        throw refused(
          `The ${['type', 'from', 'to'][position]} part ${describeReference(part)} of a substitution is not a triplet.`
        );
      }
    })
  );
}

/** The index of each target; what is to be created is reserved as a point. */
function reserve(triplets, names, targets, bindings, created, named) {
  return targets.map((target) => {
    if (target.kind === 'existing') {
      return target.index;
    }
    if (target.kind === 'address') {
      if (!triplets.isTriplet(target.address)) {
        triplets.createTripletPointAt(target.address);
        created.add(target.address);
      }
      return target.address;
    }
    const { reference } = target;
    // A name or a variable defined twice is one triplet.
    const known =
      reference?.kind === 'name'
        ? nameOf(names, reference.name)
        : reference?.kind === 'variable'
          ? (bindings.get(reference.name) ?? null)
          : null;
    if (known !== null) {
      return known;
    }
    const index = triplets.createTripletPoint();
    if (reference?.kind === 'name') {
      named.push(index);
      names.setName(index, reference.name);
    } else if (reference?.kind === 'variable') {
      bindings.set(reference.name, index);
    }
    created.add(index);
    return index;
  });
}

/** Applies the patterns under `bindings`; the index each of them wrote. */
function substitute(triplets, names, patterns, bindings, changes, named) {
  const defined = {
    names: new Set(),
    variables: new Set(),
    addresses: new Set(),
  };
  const targets = targetsOf(triplets, names, patterns, bindings, defined);
  checkParts(triplets, names, patterns, targets, bindings, defined);
  const created = new Set();
  const indices = reserve(triplets, names, targets, bindings, created, named);
  const kept = new Set();
  patterns.forEach(({ parts }, at) => {
    const index = indices[at];
    const before = triplets.getTriplet(index);
    const { type, from, to } = before ?? { type: index, from: 0, to: 0 };
    const currents = [type, from, to];
    const values = parts.map((part, position) => {
      switch (part.kind) {
        case 'any':
          return currents[position];
        case 'variable':
          return bindings.get(part.name);
        case 'address':
          return part.address;
        default: {
          const id = nameOf(names, part.name);
          if (id === null) {
            throw refused(`The name ${part.name} is not a triplet.`);
          }
          return id;
        }
      }
    });
    triplets.updateTriplet(index, ...values);
    const after = triplets.getTriplet(index);
    // A triplet two patterns write is reported once, as it ends up.
    const again = kept.has(index)
      ? changes.findLast((change) => change.after?.index === index)
      : undefined;
    if (again) {
      again.after = after;
    } else {
      changes.push({ before: created.has(index) ? null : before, after });
    }
    kept.add(index);
  });
  return indices;
}

/**
 * Runs a substitution query on a triplets view.
 * @param {ReturnType<typeof import('./triplets.js').withTriplets>} triplets
 * @param {any} names  its names store
 * @param {any[]} document  the parsed query
 * @param {number[]} [named]  collects the addresses the query gave a name
 * @returns {{ before: any, after: any }[]}  creations and updates as the
 *   substitution lists them, then deletions; a read has the same triplet on
 *   both sides
 */
export function processTripletsQuery(triplets, names, document, named = []) {
  if (document.length === 0) {
    return [];
  }
  const [restriction, substitution] = sidesOf(document);
  const restrictions = patternsOf(restriction);
  const substitutions = patternsOf(substitution);
  const solutions = [];
  if (restrictions.length === 0) {
    solutions.push({ bindings: new Map(), matched: [] });
  } else {
    solve(triplets, names, restrictions, new Map(), [], solutions);
  }
  const changes = [];
  const deletes = new Set();
  for (const { bindings, matched } of solutions) {
    const kept = new Set(
      substitute(triplets, names, substitutions, bindings, changes, named)
    );
    matched
      .filter((index) => !kept.has(index))
      .forEach((index) => deletes.add(index));
  }
  for (const index of deletes) {
    if (triplets.isTriplet(index)) {
      for (const before of triplets.deleteTriplet(index)) {
        changes.push({ before, after: null });
      }
    }
  }
  return changes;
}
