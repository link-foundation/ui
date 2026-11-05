// Usage of @link-foundation/ui-links: a links server whose types and
// permissions are links, and synced clients that see only what their user
// may read.
// Run: node examples/ui-links-permissions.mjs [--server clink]
// CLINK may select the path of a released clink (Rust 2.1.1 or newer).
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
  parseLino,
  typeMarkers,
  typeSystem,
} from '@link-foundation/ui-links';
import { connectLinks } from '@link-foundation/ui-links/tcp';
import { startClink } from './lib/ui-links-clink.mjs';

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
const backend = process.argv.slice(2);
if (
  backend.length &&
  (backend.length !== 2 ||
    backend[0] !== '--server' ||
    !['clink', 'reference'].includes(backend[1]))
) {
  throw new Error(
    'Usage: node examples/ui-links-permissions.mjs [--server reference|clink]'
  );
}
const external =
  backend[1] === 'clink' ? await startClink({ links, names, tokens }) : null;
const transports = [];
const server = createLinksServer({
  links,
  names,
  policy,
  authenticate: (token) => tokens.get(token) ?? null,
});

/** A synced client of `server`, signed in with `token`. */
async function signIn(token) {
  const transport = external
    ? await connectLinks(external.address)
    : connectInProcess(server);
  transports.push(transport);
  console.log(await transport.send(`(auth: ${token})`));
  return createSyncedLinks({ transport });
}

try {
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
  const [memo] = await boss.load([v.memo]);
  console.log('memo is still a Note:', memo.from_id === t.Note); // true

  // A note alice writes reaches the boss through the subscription.
  const draft = alice.create();
  alice.update(draft, t.Note, draft);
  await alice.flush();
  const id = alice.resolve(draft);
  await new Promise((resolve) => setTimeout(resolve, 0));
  for (
    let attempt = 0;
    attempt < 100 && allLinks(boss, [id])[0]?.from_id !== t.Note;
    attempt++
  ) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  const received = allLinks(boss, [id])[0];
  if (received?.from_id !== t.Note) {
    throw new Error('Subscription did not deliver the new note');
  }
  console.log('the boss sees the new note:', received);

  // Both servers require a reference right without revealing hidden targets.
  const link = (target) =>
    transports[1].send(`(create: (${t.Note} ${target}))`);
  const missing = await link(9999);
  const hidden = await link(v.plan);
  console.log('link to a missing address:', missing);
  console.log('link to the hidden plan:', hidden);
  const missingError = parseLino(missing)[0];
  const hiddenError = parseLino(hidden)[0];
  if (
    missingError?.id !== 'error' ||
    hiddenError?.id !== 'error' ||
    missingError.values[0] !== 'Link not found: 9999' ||
    hiddenError.values[0] !== `Link not found: ${v.plan}`
  ) {
    throw new Error('Hidden and absent references must have the same error');
  }
  const pair = boss.create();
  boss.update(pair, t.User, t.Secret);
  const grant = boss.create();
  boss.update(grant, markers.allowReference, pair);
  await boss.flush();
  const allowed = await link(v.plan);
  console.log('link to it with a rule:', allowed);
  const stillHidden = (await transports[1].send(`(each: (${v.plan}))`)) === '';
  console.log('still hidden:', stillHidden);
  if (parseLino(allowed)[0]?.id === 'error' || !stillHidden) {
    throw new Error('A reference grant must allow linking without reading');
  }
} finally {
  for (const transport of transports) {
    await transport.close();
  }
  await external?.close();
}
