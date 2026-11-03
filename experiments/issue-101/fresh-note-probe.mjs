// Why is alice's new (n: Note n) refused in examples/ui-links-permissions.mjs?
import {
  allow,
  createMemoryLinks,
  createNames,
  createPolicy,
  permissionMarkers,
  typeMarkers,
  typeSystem,
  withPermissions,
} from '@link-foundation/ui-links';
const order = process.argv[2] ?? 'secret-first';
const links = createMemoryLinks();
const names = createNames();
const types = typeSystem(links, typeMarkers(links, names));
const markers = permissionMarkers(links, names);
const t = {};
const define = (name, ...p) => {
  t[name] = types.define(...p);
  names.setName(t[name], name);
};
define('User');
define('Admin', t.User);
define('Doc');
define('Public');
if (order === 'secret-first') {
  define('Secret', t.Doc);
  define('Note', t.Doc);
} else {
  define('Note', t.Doc);
  define('Secret', t.Doc);
}
define('Shared', t.Note, t.Public);
const alice = types.instance(t.User);
allow(links, markers, 'write', t.Admin, markers.anything);
allow(links, markers, 'write', t.User, t.Note);
allow(links, markers, 'read', t.User, t.Public);
const policy = createPolicy({ rules: links, markers, types });
const view = withPermissions(links, policy, alice);
const id = view.create();
console.log({
  order,
  id,
  Note: t.Note,
  isOf: types.isOf({ id, from_id: t.Note, to_id: id }, t.Note),
  canWrite: policy.canWrite(alice, { id, from_id: t.Note, to_id: id }),
});
try {
  view.update(id, t.Note, id);
  console.log('ok');
} catch (e) {
  console.log(e.message);
}
