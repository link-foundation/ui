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
 * A rule marked `(r: AllowReference g)` lets the subjects refer to `Object`
 * and to the links of type `Object` without reading them. A subject may also
 * refer to what it may read, to itself and to the `Object` of any rule it
 * holds: `User` writes `Note` is enough to type links as `Note`. Any other
 * address answers `Link not found`, whether a link is there or not.
 *
 * The markers are points of the data (`permissionMarkers`), so every
 * address a rule holds is an address of the data. The rules (the pairs and
 * the marks) live in the same storage as the data or in another one (a
 * separate links file). Rules in the same storage are links like any other:
 * a subject that may write them may change the rules, so give `Anything`
 * writes to administrators only, or keep the rules in a storage of their own.
 */

import { CONTINUE, NULL } from './constants.js';
import { point } from './types.js';
import { watchPolicy } from './policy-watch.js';
import {
  decorate,
  ensureCreated,
  getLink,
  isAddress,
  LinksError,
  linkOf,
  normalizeQuery,
  notFound,
} from './links.js';

/**
 * @typedef {{ id: number, from_id: number, to_id: number }} Link
 * @typedef {{ allowRead: number, allowWrite: number, allowReference: number, anything: number }} PermissionMarkers
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
    /** An isolated readable-types cache for a server. */
    watch: () => watchPolicy({ rules, markers, types }),
    /** Whether `subject` may read `link` (writing allows reading). */
    canRead: (subject, link) =>
      allows(markers.allowRead, subject, link) ||
      allows(markers.allowWrite, subject, link),
    /** Whether `subject` may write `link` (as it is or as it will be). */
    canWrite: (subject, link) => allows(markers.allowWrite, subject, link),
    /**
     * Whether `subject` may refer to `link` without reading it: it is the
     * subject, the object of a rule it holds, or `AllowReference` covers it.
     * Reading allows referring (`withPermissions` checks both).
     */
    canReference: (subject, link) =>
      link.id === subject ||
      allows(markers.allowReference, subject, link) ||
      [markers.allowRead, markers.allowWrite, markers.allowReference].some(
        (marker) =>
          granted(marker).some(
            (rule) => rule.to_id === link.id && isSubject(subject, rule.from_id)
          )
      ),
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
 * An update needs the right to write the link before and after it, and a
 * reference it adds needs the right to refer to that address; without it the
 * address is `not-found`, so a hidden link answers as a missing one does. So
 * does choosing the address of a new link (`createAt`). A link
 * the subject created through this view is its own while it has no type
 * (its source is 0), so undoing the update that typed it makes it its own
 * again. `forget(id)` drops that claim when the link is gone (deleted or its
 * creation undone), so a later link at the same address is not the
 * subject's.
 * @param {any} links
 * @param {ReturnType<typeof createPolicy>} policy
 * @param {number | null | (() => number | null)} subject
 */
export function withPermissions(links, policy, subject) {
  const who = typeof subject === 'function' ? subject : () => subject;
  /** The addresses of the links created through this view. */
  const created = new Set();
  const own = (link) => link.from_id === NULL && created.has(link.id);
  const readable = (link) => own(link) || policy.canRead(who(), link);
  const writable = (link) => own(link) || policy.canWrite(who(), link);
  /** A missing address is judged as an untyped link: only `Anything` covers it. */
  const canReference = (id) => {
    const link = getLink(links, id) ?? linkOf(id, NULL, NULL);
    return readable(link) || policy.canReference?.(who(), link) === true;
  };
  /** The references `before` does not hold yet need the right. */
  const checkReferences = (before, source, target) => {
    for (const part of [source, target]) {
      if (
        part !== NULL &&
        part !== before.id &&
        part !== before.from_id &&
        part !== before.to_id &&
        isAddress(part) &&
        !canReference(part)
      ) {
        throw notFound(part);
      }
    }
  };
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
      created.add(id);
      return id;
    },
    update(id, source, target) {
      const before = visible(id);
      if (before === null) {
        return links.update(id, source, target);
      }
      if (own(before) && source === NULL) {
        // Still without a type: still its creator's own.
        checkReferences(before, source, target);
        return links.update(id, source, target);
      }
      const after = linkOf(id, source, target);
      if (!writable(before) || !policy.canWrite(who(), after)) {
        throw forbidden(`update ${id}`);
      }
      checkReferences(before, source, target);
      return links.update(id, source, target);
    },
    delete(id) {
      const before = visible(id);
      if (before !== null && !writable(before)) {
        throw forbidden(`delete ${id}`);
      }
      created.delete(id);
      return links.delete(id);
    },
    /** The link at `id` is gone: a new one there is not the subject's own. */
    forget(id) {
      created.delete(id);
    },
    canReference,
  };
  // Without it `ensureCreated` would create links up to the address through the
  // view, and stop at a hidden one: this check is needed on every storage.
  methods.createAt = (id) => {
    if (!policy.canCreate(who())) {
      throw forbidden('create');
    }
    if (isAddress(id) && !canReference(id)) {
      throw notFound(id);
    }
    if (typeof links.createAt === 'function') {
      links.createAt(id);
    } else if (!ensureCreated(links, id)) {
      throw new LinksError('exists', `Link ${id} exists`);
    }
    created.add(id);
  };
  return decorate(links, methods);
}

/**
 * The markers of the permission rules by name: `AllowRead`, `AllowWrite`,
 * `AllowReference` and `Anything`, points of the data created when missing.
 * @param {any} links  the storage of the data
 * @param {any} names  its names store
 * @returns {PermissionMarkers}
 */
export function permissionMarkers(links, names) {
  return {
    allowRead: point(links, names, 'AllowRead'),
    allowWrite: point(links, names, 'AllowWrite'),
    allowReference: point(links, names, 'AllowReference'),
    anything: point(links, names, 'Anything'),
  };
}

/**
 * Write a rule: `subject` may `access` (`'read'`, `'write'` or
 * `'reference'`) links of `object`. Returns the address of the rule pair.
 * @param {any} rules
 * @param {PermissionMarkers} markers
 */
export function allow(rules, markers, access, subject, object) {
  const marker = {
    read: markers.allowRead,
    write: markers.allowWrite,
    reference: markers.allowReference,
  }[access];
  if (marker === undefined) {
    throw new LinksError('bad-request', `Unknown access: ${access}`);
  }
  if (
    subject === markers.allowRead ||
    subject === markers.allowWrite ||
    subject === markers.allowReference
  ) {
    // A pair from a marker would read as a mark.
    throw new LinksError('bad-request', 'A marker cannot be a subject');
  }
  const rule = rules.create();
  rules.update(rule, subject, object);
  const mark = rules.create();
  rules.update(mark, marker, rule);
  return rule;
}
