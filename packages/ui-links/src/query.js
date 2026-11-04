/**
 * Substitution queries over any storage: the query language of link-cli
 * (https://github.com/link-foundation/link-cli, docs/HOW-IT-WORKS.md).
 *
 * A query is `(restriction) (substitution)`. The restriction matches links
 * (numbers, names, `$variables`, `*`, nested links, explicit indexes); the
 * substitution says what they become:
 *
 * - `() ((1 1))` creates, `((1 2)) ()` deletes (with every link that uses
 *   the deleted ones), `((1: 1 1)) ((1: 1 2))` updates: patterns are paired
 *   by index, an unpaired restriction deletes, an unpaired substitution
 *   creates (reusing an equal link: deduplication);
 * - the same restriction and substitution is a read, reported as a change
 *   whose `before` and `after` are equal.
 *
 * A query is atomic here: when it fails, its writes are undone.
 */

import { ANY, NULL } from './constants.js';
import { deleteCascade, netChanges, observe } from './decorators.js';
import {
  allLinks,
  ensureCreated,
  exists,
  getLink,
  LinksError,
  notFound,
  search,
} from './links.js';
import { formatLino, parseLino } from './lino.js';

/**
 * @typedef {{ index: string, source: Pattern | null, target: Pattern | null }} Pattern
 * @typedef {import('./decorators.js').Change} Change
 */

const isVariable = (ident) => ident.startsWith('$');
const isNumber = (ident) => /^[0-9]+$/.test(ident);
/** A name: an identifier that is not a number, a variable or `*`. */
const isNameIdent = (ident) =>
  ident !== '' && ident !== '*' && !isVariable(ident) && !isNumber(ident);
const NONE = -1;

/** A pattern from a LiNo value. */
export function patternOf(value) {
  if (typeof value === 'string') {
    return { index: value, source: null, target: null };
  }
  if (value.values.length === 2) {
    return {
      index: value.id ?? '',
      source: patternOf(value.values[0]),
      target: patternOf(value.values[1]),
    };
  }
  if (value.values.length === 0 && value.id === null) {
    return null;
  }
  throw new LinksError(
    'bad-request',
    `A pattern is a reference or a pair, found ${formatLino([value])}`
  );
}

/** The patterns of one side of a query. */
function sidePatterns(side) {
  if (typeof side === 'string') {
    return [patternOf(side)];
  }
  const patterns = side.values.map(patternOf).filter((p) => p !== null);
  if (side.id !== null) {
    patterns.unshift(patternOf({ id: side.id, values: side.values }));
  }
  return patterns;
}

/**
 * The two sides of a query document: `restriction substitution` or one link
 * holding both.
 * @returns {[any, any] | null}
 */
export function querySides(document) {
  const [first] = document;
  if (first !== undefined && typeof first !== 'string') {
    if (first.id === null && first.values.length >= 2) {
      return [first.values[0], first.values[1]];
    }
  }
  if (document.length >= 2) {
    return [document[0], document[1]];
  }
  return null;
}

const isLeaf = (p) => p.source === null;

/**
 * Run `fn(links, recorded, named)` as one atomic write on `context.links`:
 * `links` reports every write into `recorded`; `named` collects the
 * addresses `fn` gave a name. On success the result is the net change of
 * every link (no link refers to a missing address; the names of deleted
 * links are removed); on failure every write and new name is undone.
 *
 * When `context.links` is a restricted view (`withPermissions`),
 * `context.base` is the storage under it: references are checked and writes
 * undone there, since a link the subject may not read still exists, and
 * undoing the subject's own writes needs no permission.
 * @returns {Change[]}
 */
export function transact(context, fn) {
  const recorded = [];
  const named = [];
  const raw = context.links;
  const base = context.base ?? raw;
  const links = observe(raw, (change) => recorded.push(change));
  const names = context.names?.withLinks?.(links) ?? context.names;
  try {
    fn(links, recorded, named, names);
    let changes = netChanges(recorded);
    changes.forEach(({ after }) => checkReferences(base, after));
    for (const { before, after } of changes) {
      if (after === null && before !== null) {
        names?.removeName(before.id);
      }
    }
    changes = netChanges(recorded);
    return changes;
  } catch (error) {
    undo(context, base, recorded, named);
    throw error;
  }
}

/** A `not-found` error when `link` refers to a missing link of `base`. */
function checkReferences(base, link) {
  if (link === null) {
    return;
  }
  for (const part of [link.from_id, link.to_id]) {
    if (part !== NULL && part !== link.id && !exists(base, part)) {
      throw notFound(part);
    }
  }
}

/** Undo a failed `transact`: its writes (on `base`) and its new names. */
function undo(context, base, recorded, named) {
  rollback(base, recorded);
  for (const { before, after } of recorded) {
    if (before === null && after !== null) {
      context.links.forget?.(after.id);
    }
  }
  for (const id of context.names?.withLinks ? [] : named) {
    context.names?.removeName(id);
  }
}

/**
 * Run a query on `links`.
 * @param {object} context
 * @param {any} context.links  a storage
 * @param {any} [context.base]  the storage under `links` when it is a
 *   restricted view (see `transact`)
 * @param {any} [context.names]  a names store
 * @param {boolean} [context.autoCreate]  create missing references as
 *   points `(x: x x)` (link-cli's `--auto-create-missing-references`)
 * @param {string | any[]} query  LiNo text or a parsed document
 * @returns {Change[]}  the net change of every link the query touched
 */
export function runQuery(context, query) {
  const document = typeof query === 'string' ? parseLino(query) : query;
  const sides = querySides(document);
  if (sides === null) {
    throw new LinksError(
      'bad-request',
      'A query is a restriction and a substitution'
    );
  }
  return transact(context, (links, recorded, named, names) =>
    createRun({ ...context, links, recorded, named, names })(sides[0], sides[1])
  );
}

/** Undo recorded changes, last first. */
export function rollback(links, recorded) {
  for (const { before, after } of [...recorded].reverse()) {
    if (before !== null && after !== null && before === after) {
      continue;
    }
    if (before === null) {
      links.delete(after.id);
    } else {
      if (after === null) {
        ensureCreated(links, before.id);
      }
      links.update(before.id, before.from_id, before.to_id);
    }
  }
}

/** Reading a query: identifiers, patterns and their solutions. */
function createMatcher(links, names) {
  const nameToId = (ident) => names?.getByName(ident) ?? null;

  /** An identifier read without writing; `fallback` when it is open. */
  const resolve = (ident, solution, fallback) => {
    if (ident === '') {
      return fallback;
    }
    if (ident === '*') {
      return ANY;
    }
    if (solution.has(ident)) {
      return solution.get(ident);
    }
    if (isVariable(ident)) {
      return fallback;
    }
    if (isNumber(ident)) {
      return Number(ident);
    }
    return nameToId(ident) ?? NONE;
  };

  /** Bind or check `ident` against `value` in `local`. */
  const bind = (ident, value, local) => {
    if (ident === '' || ident === '*') {
      return true;
    }
    if (isVariable(ident)) {
      if (local.has(ident)) {
        return local.get(ident) === value;
      }
      local.set(ident, value);
      return true;
    }
    if (isNumber(ident)) {
      return Number(ident) === value;
    }
    return nameToId(ident) === value;
  };

  /** The solution extended by `link` matching `pattern`, or `null`. */
  const matchLink = (pattern, link, solution) => {
    const local = new Map(solution);
    if (!bind(pattern.index, link.id, local)) {
      return null;
    }
    if (isLeaf(pattern)) {
      return local;
    }
    let out = local;
    for (const [sub, value] of [
      [pattern.source, link.from_id],
      [pattern.target, link.to_id],
    ]) {
      if (isLeaf(sub)) {
        if (!bind(sub.index, value, out)) {
          return null;
        }
      } else {
        const inner = getLink(links, value);
        out = inner === null ? null : matchLink(sub, inner, out);
        if (out === null) {
          return null;
        }
      }
    }
    return out;
  };

  /** The links `pattern` can match under `solution`. */
  const candidates = (pattern, solution) => {
    const id = resolve(pattern.index, solution, ANY);
    if (id === NONE) {
      return [];
    }
    const part = (sub) =>
      sub === null || !isLeaf(sub) ? ANY : resolve(sub.index, solution, ANY);
    const from = part(pattern.source);
    const to = part(pattern.target);
    if (from === NONE || to === NONE) {
      return [];
    }
    return allLinks(links, { id, from_id: from, to_id: to });
  };

  /** `[link, solution]` for every link `pattern` matches. */
  const matches = (pattern, solution) =>
    candidates(pattern, solution)
      .map((link) => [link, matchLink(pattern, link, solution)])
      .filter(([, s]) => s !== null);

  const solve = (patterns) => {
    let solutions = [new Map()];
    for (const pattern of patterns) {
      solutions = solutions.flatMap((s) =>
        matches(pattern, s).map(([, n]) => n)
      );
      if (solutions.length === 0) {
        break;
      }
    }
    return solutions;
  };

  /** The address a restriction pattern pins, or `null` for a wildcard. */
  const pinned = (pattern, solution) => {
    const id = resolve(pattern.index, solution, ANY);
    return id === ANY || id === NONE ? null : id;
  };

  return { nameToId, resolve, matches, solve, pinned };
}

/** Writing a query: the substitution side and the deletions. */
function createWriter(
  { links, names, autoCreate = false, recorded, named },
  { nameToId, resolve }
) {
  const point = (id) => links.update(id, id, id);

  /** Reserve a link for every new name an index of the substitution gives. */
  const reserveNames = (pattern) => {
    if (pattern === null || isLeaf(pattern)) {
      return;
    }
    reserveNames(pattern.source);
    reserveNames(pattern.target);
    if (isNameIdent(pattern.index) && nameToId(pattern.index) === null) {
      if (!names) {
        throw new LinksError(
          'bad-request',
          `No names store for ${pattern.index}`
        );
      }
      const id = links.create();
      names.setName(id, pattern.index);
      named.push(id);
    }
  };

  /** The address of a leaf of the substitution; creates points if asked. */
  const leafAddress = (ident, solution) => {
    if (ident === '' || ident === '*') {
      throw new LinksError(
        'bad-request',
        `Cannot create a link from "${ident}"`
      );
    }
    if (solution.has(ident)) {
      return solution.get(ident);
    }
    if (isVariable(ident)) {
      throw new LinksError('bad-request', `Unbound variable ${ident}`);
    }
    if (isNumber(ident)) {
      const id = Number(ident);
      if (id !== NULL && autoCreate && !exists(links, id)) {
        ensureCreated(links, id);
        point(id);
      }
      return id;
    }
    const known = nameToId(ident);
    if (known !== null) {
      return known;
    }
    if (!autoCreate || !names) {
      throw notFound(ident);
    }
    const id = links.create();
    point(id);
    names.setName(id, ident);
    named.push(id);
    return id;
  };

  /** Write `(id: source target)` unless it is already so; report a read. */
  const put = (id, source, target) => {
    const stored = getLink(links, id);
    if (stored.from_id !== source || stored.to_id !== target) {
      links.update(id, source, target);
    } else {
      recorded.push(Object.freeze({ before: stored, after: stored }));
    }
    return id;
  };

  /** Create (or find) what a substitution pattern describes. */
  const ensure = (pattern, solution) => {
    if (isLeaf(pattern)) {
      return leafAddress(pattern.index, solution);
    }
    const index = pattern.index;
    let id = resolve(index, solution, NULL);
    const partOf = (sub, which) => {
      const value = ensure(sub, solution);
      if (value !== ANY) {
        return value;
      }
      const stored = id > NULL && id !== NONE ? getLink(links, id) : null;
      if (stored === null) {
        throw new LinksError('bad-request', 'Cannot create a link with *');
      }
      return stored[which];
    };
    const source = partOf(pattern.source, 'from_id');
    const target = partOf(pattern.target, 'to_id');
    if (id === NONE) {
      throw notFound(index);
    }
    if (id === NULL) {
      const existing = search(links, source, target);
      if (existing) {
        id = existing.id;
      } else {
        id = links.create();
        links.update(id, source, target);
      }
      if (isVariable(index)) {
        solution.set(index, id);
      }
      return id;
    }
    ensureCreated(links, id);
    return put(id, source, target);
  };

  const remove = (link) => {
    if (exists(links, link.id)) {
      deleteCascade(links, link.id);
    }
  };

  return { reserveNames, ensure, remove };
}

function createRun(context) {
  const { links, recorded } = context;
  const { resolve, matches, solve, pinned } = createMatcher(
    links,
    context.names
  );
  const { reserveNames, ensure, remove } = createWriter(context, {
    nameToId: (ident) => context.names?.getByName(ident) ?? null,
    resolve,
  });

  /**
   * Apply the substitution for one solution: write the links it names,
   * delete the pinned links it drops and the wildcard matches, then create
   * the new ones. `intended` collects the links it writes.
   */
  const substitute = (restriction, substitution, solution, intended) => {
    const before = new Map();
    const wildcards = [];
    for (const pattern of restriction) {
      const id = pinned(pattern, solution);
      if (id === null) {
        wildcards.push(...matches(pattern, solution).map(([link]) => link));
      } else if (exists(links, id)) {
        before.set(id, pattern);
      }
    }
    const fresh = [];
    for (const pattern of substitution) {
      if (resolve(pattern.index, solution, NULL) === NULL) {
        fresh.push(pattern);
        continue;
      }
      const written = ensure(pattern, solution);
      before.delete(written);
      const link = getLink(links, written);
      if (link !== null) {
        intended.set(written, link);
        if (isLeaf(pattern)) {
          recorded.push(Object.freeze({ before: link, after: link }));
        }
      }
    }
    for (const id of [...before.keys()].sort((a, b) => a - b)) {
      remove({ id });
    }
    wildcards.forEach(remove);
    for (const pattern of fresh) {
      ensure(pattern, solution);
    }
  };

  return (restrictionSide, substitutionSide) => {
    const restriction = sidePatterns(restrictionSide);
    const substitution = sidePatterns(substitutionSide);
    substitution.forEach(reserveNames);
    if (restriction.length === 0) {
      for (const pattern of substitution) {
        ensure(pattern, new Map());
      }
      return;
    }
    if (substitution.length === 0) {
      restriction
        .flatMap((p) => matches(p, new Map()).map(([link]) => link))
        .sort((a, b) => a.id - b.id)
        .forEach(remove);
      return;
    }
    const intended = new Map();
    for (const solution of solve(restriction)) {
      substitute(restriction, substitution, solution, intended);
    }
    // A cascade of a later deletion may take a link written before: put
    // it back.
    for (const link of intended.values()) {
      if (!exists(links, link.id)) {
        ensureCreated(links, link.id);
        links.update(link.id, link.from_id, link.to_id);
      }
    }
  };
}
