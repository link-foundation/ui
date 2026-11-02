// The same as fresh-note-probe.mjs, through a server session and a synced
// client, logging each request; argv[2] = 'auth' signs in with (auth: …),
// anything else passes the subject to connectInProcess.
import {
  allow,
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
const mode = process.argv[2] ?? 'auth';
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
define('Doc');
define('Note', t.Doc);
const alice = types.instance(t.User);
allow(links, markers, 'write', t.User, t.Note);
const policy = createPolicy({ rules: links, markers, types });
const server = createLinksServer({
  links,
  names,
  policy,
  authenticate: () => alice,
});
const transport = connectInProcess(server, {
  subject: mode === 'auth' ? null : alice,
});
const send = transport.send;
transport.send = async (text) => {
  const reply = await send(text);
  console.log('>', text, '\n<', reply);
  return reply;
};
if (mode === 'auth') {
  await transport.send('(auth: x)');
}
const client = createSyncedLinks({ transport });
client.onError((e, w) => console.log('error', w?.kind, e.message));
const id = client.create();
client.update(id, t.Note, id);
await client.flush();
const after = { id: 12, from_id: t.Note, to_id: 12 };
console.log(
  'canWrite after:',
  policy.canWrite(alice, after),
  'isOf:',
  types.isOf(after, t.Note),
  'stored 12:',
  links.count([12]) && [
    ...(function* () {
      const out = [];
      links.each(
        (l) => {
          out.push(l);
          return 4294967295;
        },
        { id: 12, from_id: 4294967292, to_id: 4294967292 }
      );
      yield* out;
    })(),
  ]
);
console.log('canCreate', policy.canCreate(alice));
