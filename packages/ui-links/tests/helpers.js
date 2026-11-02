/** Shared helpers of the ui-links tests. */

/** The `code` of the error `fn` throws (awaited), or `undefined`. */
export function errorCode(fn) {
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      return result.then(
        () => undefined,
        (error) => error.code ?? error.name
      );
    }
  } catch (error) {
    return error.code ?? error.name;
  }
  return undefined;
}

import {
  allow,
  createMemoryLinks,
  createNames,
  createPolicy,
  permissionMarkers,
  typeMarkers,
  typeSystem,
} from '@link-foundation/ui-links';

/**
 * A small world of types, subjects, data and rules:
 *
 *   Type -> User -> Admin              alice: User, boss: Admin
 *   Type -> Doc -> Note -> Shared      Shared extends Public too
 *   Type -> Doc -> Secret
 *   Type -> Public
 *
 * Admins write anything, users write notes and read what is public.
 * @param {{ separateRules?: boolean }} [options]  keep the rules in a
 *   storage of their own
 */
export function world({ separateRules = false } = {}) {
  const links = createMemoryLinks();
  const names = createNames();
  const types = typeSystem(links, typeMarkers(links, names));
  const markers = permissionMarkers(links, names);
  const t = {};
  const define = (name, ...parents) => {
    t[name] = types.define(...parents);
    names.setName(t[name], name);
  };
  define('User');
  define('Admin', t.User);
  define('Doc');
  define('Public');
  define('Note', t.Doc);
  define('Shared', t.Note, t.Public);
  define('Secret', t.Doc);
  const v = {};
  for (const [name, type] of [
    ['alice', t.User],
    ['boss', t.Admin],
    ['note', t.Note],
    ['shared', t.Shared],
    ['secret', t.Secret],
  ]) {
    v[name] = types.instance(type);
    names.setName(v[name], name);
  }
  const rules = separateRules ? createMemoryLinks() : links;
  allow(rules, markers, 'write', t.Admin, markers.anything);
  allow(rules, markers, 'write', t.User, t.Note);
  allow(rules, markers, 'read', t.User, t.Public);
  const policy = createPolicy({ rules, markers, types });
  return { links, names, types, markers, rules, policy, t, v };
}
