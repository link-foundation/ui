// Usage of @link-foundation/ui-links: a links server whose types and
// permissions are links, and synced clients that see only what their user
// may read.
// Run: node examples/ui-links-permissions.mjs
import {
  allow,
  allLinks,
  connectInProcess,
  createLinksServer,
  createMemoryLinks,
  createNames,
  createPolicy,
  createSyncedLinks,
  permissionMarkers,
  typeMarkers,
  typeSystem,
} from '@link-foundation/ui-links';

// The data: Type -> User -> Admin, Type -> Doc -> Note -> Shared, and
// Shared is Public too (multiple inheritance).
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
define('Secret', t.Doc);
define('Note', t.Doc);
define('Shared', t.Note, t.Public);
const v = {};
for (const [name, type] of [
  ['alice', t.User],
  ['boss', t.Admin],
  ['plan', t.Secret],
  ['memo', t.Note],
  ['news', t.Shared],
]) {
  v[name] = types.instance(type);
  names.setName(v[name], name);
}
console.log('news is a Doc:', types.isA(v.news, t.Doc)); // true
console.log('news is Public:', types.isA(v.news, t.Public)); // true

// The rules, links too: admins write anything, users write notes and read
// what is public.
allow(links, markers, 'write', t.Admin, markers.anything);
allow(links, markers, 'write', t.User, t.Note);
allow(links, markers, 'read', t.User, t.Public);
const policy = createPolicy({ rules: links, markers, types });

const tokens = new Map([
  ['alice-token', v.alice],
  ['boss-token', v.boss],
]);
const server = createLinksServer({
  links,
  names,
  policy,
  authenticate: (token) => tokens.get(token) ?? null,
});

/** A synced client of `server`, signed in with `token`. */
async function signIn(token) {
  const transport = connectInProcess(server);
  console.log(await transport.send(`(auth: ${token})`));
  return createSyncedLinks({ transport });
}

const boss = await signIn('boss-token');
const alice = await signIn('alice-token');

// The boss keeps everything up to date; alice loads what she may read.
await boss.subscribe([]);
await alice.load([]);
const visible = allLinks(alice).map((link) => names.getName(link.id));
console.log('alice sees:', visible); // memo and news, not plan

// A write alice may not make is rolled back in her cache.
alice.onError((error, write) =>
  console.log(`refused ${write.kind}: ${error.message}`)
);
alice.update(v.memo, t.Secret, v.memo);
await alice.flush();
console.log('memo is still a Note:', types.isA(v.memo, t.Note)); // true

// A note alice writes reaches the boss through the subscription.
const draft = alice.create();
alice.update(draft, t.Note, draft);
await alice.flush();
const id = alice.resolve(draft);
await new Promise((resolve) => setTimeout(resolve, 0));
console.log('the boss sees the new note:', allLinks(boss, [id])[0]);
