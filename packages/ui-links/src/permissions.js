/**
 * Permissions stored as links: an optional layer over any storage.
 *
 * A rule is a pair `(g: Subject Object)` marked as `(r: AllowRead g)` or
 * `(r: AllowWrite g)`: the subjects that are `Subject` (the subject itself,
 * or a link of that type) may read, or read and write, the links of type
 * `Object` (its values and sub-types, not the link of `Object` itself: a
 * type is changed by who may change its parent). The `Anything` marker in
 * either place matches every subject or every link. Types follow the type
 * system: through sub-types and multiple inheritance; the links that wire
 * the hierarchy are of type `Extends`.
 *
 * The markers are points of the data (`permissionMarkers`), so every
 * address a rule holds is an address of the data. The rules (the pairs and
 * the marks) live in the same storage as the data or in another one (a
 * separate links file). Rules in the same storage are links like any other:
 * a subject that may write them may change the rules, so give `Anything`
 * writes to administrators only, or keep the rules in a storage of their own.
 */

import { CONTINUE } from './constants.js';
import { point } from './types.js';
import {
  decorate,
  getLink,
  LinksError,
  linkOf,
  normalizeQuery,
  notFound,
} from './links.js';

/**
 * @typedef {{ id: number, from_id: number, to_id: number }} Link
 * @typedef {{ allowRead: number, allowWrite: number, anything: number }} PermissionMarkers
 */

export const forbidden = (what) =>
  new LinksError('forbidden', `Forbidden: ${what}`);

/**
 * A policy: who may read and write what.
 * @param {object} options
 * @param {any} options.rules  the storage of the rules
 * @param {PermissionMarkers} options.markers
 * @param {ReturnType<typeof import('./types.js').typeSystem>} options.types  the types of the data
 */
export function createPolicy({ rules, markers, types }) {
  /** The rules `(Subject Object)` a marker gives. */
  const granted = (marker) => {
    const out = [];
    rules.each(
      (mark) => {
        const rule = getLink(rules, mark.to_id);
        if (rule !== null) {
          out.push(rule);
        }
        return CONTINUE;
      },
      { from_id: marker }
    );
    return out;
  };
  const isSubject = (subject, type) =>
    type === markers.anything || (subject !== null && types.isA(subject, type));
  const isObject = (link, type) =>
    type === markers.anything || types.isOf(link, type);

  /** Whether `subject` (an address or `null`) may do what `marker` allows to `link`. */
  const allows = (marker, subject, link) =>
    granted(marker).some(
      (rule) => isSubject(subject, rule.from_id) && isObject(link, rule.to_id)
    );

  return {
    markers,
    /** Whether `subject` may read `link` (writing allows reading). */
    canRead: (subject, link) =>
      allows(markers.allowRead, subject, link) ||
      allows(markers.allowWrite, subject, link),
    /** Whether `subject` may write `link` (as it is or as it will be). */
    canWrite: (subject, link) => allows(markers.allowWrite, subject, link),
    /** Whether `subject` may write anything at all: it may create links. */
    canCreate: (subject) =>
      granted(markers.allowWrite).some((rule) =>
        isSubject(subject, rule.from_id)
      ),
  };
}

/**
 * The storage as `subject` sees it: `each` and `count` skip what it may not
 * read; a write it may not do throws `forbidden`, the storage unchanged.
 * An update needs the right to write the link before and after it. A link
 * the subject created is its own until its first update gives it a type.
 * @param {any} links
 * @param {ReturnType<typeof createPolicy>} policy
 * @param {number | null | (() => number | null)} subject
 */
export function withPermissions(links, policy, subject) {
  const who = typeof subject === 'function' ? subject : () => subject;
  const fresh = new Set();
  const readable = (link) => fresh.has(link.id) || policy.canRead(who(), link);
  const writable = (link) => fresh.has(link.id) || policy.canWrite(who(), link);
  /** The stored link; a hidden one is as missing as a deleted one. */
  const visible = (id) => {
    const link = getLink(links, id);
    if (link !== null && !readable(link)) {
      throw notFound(id);
    }
    return link;
  };
  const each = (handler, query) =>
    links.each((link) => (readable(link) ? handler(link) : CONTINUE), query);
  const methods = {
    each,
    count(query) {
      let n = 0;
      each(() => {
        n++;
        return CONTINUE;
      }, normalizeQuery(query));
      return n;
    },
    create() {
      if (!policy.canCreate(who())) {
        throw forbidden('create');
      }
      const id = links.create();
      fresh.add(id);
      return id;
    },
    update(id, source, target) {
      const before = visible(id);
      if (before === null) {
        return links.update(id, source, target);
      }
      const after = linkOf(id, source, target);
      if (!writable(before) || !policy.canWrite(who(), after)) {
        throw forbidden(`update ${id}`);
      }
      fresh.delete(id);
      return links.update(id, source, target);
    },
    delete(id) {
      const before = visible(id);
      if (before !== null && !writable(before)) {
        throw forbidden(`delete ${id}`);
      }
      fresh.delete(id);
      return links.delete(id);
    },
  };
  if (typeof links.createAt === 'function') {
    methods.createAt = (id) => {
      if (!policy.canCreate(who())) {
        throw forbidden('create');
      }
      const result = links.createAt(id);
      fresh.add(id);
      return result;
    };
  }
  return decorate(links, methods);
}

/**
 * The markers of the permission rules by name: `AllowRead`, `AllowWrite` and
 * `Anything`, points of the data created when missing.
 * @param {any} links  the storage of the data
 * @param {any} names  its names store
 * @returns {PermissionMarkers}
 */
export function permissionMarkers(links, names) {
  return {
    allowRead: point(links, names, 'AllowRead'),
    allowWrite: point(links, names, 'AllowWrite'),
    anything: point(links, names, 'Anything'),
  };
}

/**
 * Write a rule: `subject` may `access` (`'read'` or `'write'`) links of
 * `object`. Returns the address of the rule pair.
 * @param {any} rules
 * @param {PermissionMarkers} markers
 */
export function allow(rules, markers, access, subject, object) {
  if (access !== 'read' && access !== 'write') {
    throw new LinksError('bad-request', `Unknown access: ${access}`);
  }
  if (subject === markers.allowRead || subject === markers.allowWrite) {
    // A pair from a marker would read as a mark.
    throw new LinksError('bad-request', 'A marker cannot be a subject');
  }
  const marker = access === 'write' ? markers.allowWrite : markers.allowRead;
  const rule = rules.create();
  rules.update(rule, subject, object);
  const mark = rules.create();
  rules.update(mark, marker, rule);
  return rule;
}
