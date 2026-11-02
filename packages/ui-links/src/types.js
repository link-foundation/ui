/**
 * Types as links, in the style of link-cli's pinned types
 * (`PinnedTypes.cs`: a type is `(T: Type T)`, `IsType` is "the source is
 * Type"), extended to a hierarchy:
 *
 * - the type of a link is its source: `(v: S x)` is a value of type `S`;
 * - a type points at itself: the root `(Type: Type Type)` is a point, a
 *   sub-type is `(S: T S)`, a value of type `T` whose target is itself;
 * - more parents (multiple inheritance) are links `(p: S T2)` marked by
 *   `(m: Extends p)`.
 *
 * So `Type -> SubType -> SubType -> Value` is a chain of sources, of any
 * depth, and `isA` follows sources and `Extends` links, cycles included.
 * The links that wire the hierarchy, the marked pairs and their marks, are
 * of type `Extends`: what may change them may change the hierarchy.
 */

import { CONTINUE, NULL } from './constants.js';
import { getLink, LinksError, search } from './links.js';

/**
 * @typedef {{ id: number, from_id: number, to_id: number }} Link
 */

/**
 * The type functions over `links`.
 * @param {any} links  the storage the types and values live in
 * @param {{ root: number, extends?: number | null }} markers  the address of
 *   the root type and of the `Extends` marker
 */
export function typeSystem(links, { root, extends: extendsMarker = null }) {
  const linkOf = (value) =>
    typeof value === 'number' ? getLink(links, value) : value;

  /** The type of a link: its source; `null` for a missing link. */
  const typeOf = (value) => {
    const link = linkOf(value);
    return link === null ? null : link.from_id;
  };

  /** Whether `id` is a type: it points at itself. */
  const isType = (id) => {
    const link = getLink(links, id);
    return link !== null && link.to_id === id;
  };

  /** The direct parents of a type: its source and what it `Extends`. */
  const parentsOf = (type) => {
    const link = getLink(links, type);
    if (link === null) {
      return [];
    }
    const out = link.from_id === type ? [] : [link.from_id];
    if (extendsMarker !== null) {
      links.each(
        (more) => {
          if (search(links, extendsMarker, more.id) !== null) {
            out.push(more.to_id);
          }
          return CONTINUE;
        },
        { from_id: type }
      );
    }
    return out.filter((parent) => parent !== NULL);
  };

  /** Whether `id` is a pair that gives a type one more parent. */
  const isExtension = (id) =>
    extendsMarker !== null && search(links, extendsMarker, id) !== null;

  /**
   * Whether `value` (an address, or a link that is not stored yet) is of
   * `type`, through any number of sub-types and parents. A type is not of
   * itself; `isA` is.
   */
  const isOf = (value, type) => {
    const link = linkOf(value);
    if (link === null) {
      return false;
    }
    const seen = new Set();
    const stack = [isExtension(link.id) ? extendsMarker : link.from_id];
    while (stack.length > 0) {
      const at = stack.pop();
      if (at === type) {
        return true;
      }
      if (seen.has(at) || at === NULL) {
        continue;
      }
      seen.add(at);
      stack.push(...parentsOf(at));
    }
    return false;
  };

  /** Whether `value` is `type` or of `type`. */
  const isA = (value, type) => linkOf(value)?.id === type || isOf(value, type);

  /** Every type `type` is, itself first (breadth first, no repeats). */
  const ancestorsOf = (type) => {
    const out = [type];
    for (let i = 0; i < out.length; i++) {
      for (const parent of parentsOf(out[i])) {
        if (!out.includes(parent)) {
          out.push(parent);
        }
      }
    }
    return out;
  };

  /**
   * Define a type `(S: parent S)`, with more parents through `Extends`.
   * @returns {number} the new type
   */
  const define = (parent = root, ...more) => {
    if (more.length > 0 && extendsMarker === null) {
      throw new LinksError(
        'bad-request',
        'Multiple parents need an Extends marker'
      );
    }
    const id = links.create();
    links.update(id, parent, id);
    for (const other of more) {
      const pair = links.create();
      links.update(pair, id, other);
      const mark = links.create();
      links.update(mark, extendsMarker, pair);
    }
    return id;
  };

  /** A value `(v: type target)`; the target is the value itself by default. */
  const instance = (type, target = null) => {
    const id = links.create();
    links.update(id, type, target === null ? id : target);
    return id;
  };

  return {
    root,
    typeOf,
    isType,
    parentsOf,
    ancestorsOf,
    isExtension,
    isOf,
    isA,
    define,
    instance,
  };
}

/**
 * The points a type system needs, by name: `Type` and `Extends`, created as
 * points when missing.
 * @param {any} links
 * @param {any} names  a names store
 * @returns {{ root: number, extends: number }}
 */
export function typeMarkers(links, names) {
  return {
    root: point(links, names, 'Type'),
    extends: point(links, names, 'Extends'),
  };
}

/** The point of `name`, created when missing. */
export function point(links, names, name) {
  const known = names.getByName(name);
  if (known !== null && getLink(links, known) !== null) {
    return known;
  }
  const id = links.create();
  links.update(id, id, id);
  names.setName(id, name);
  return id;
}
