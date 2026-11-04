# @link-foundation/ui-links

Associative links (doublets) behind one storage interface, for the data of
link-ui applications:

- **storages**: memory, SQLite, [doublets-web](https://github.com/linksplatform/doublets-web),
  and IndexedDB, `localStorage` or Links Notation text through persistence
  adapters;
- **substitution queries** of [link-cli](https://github.com/link-foundation/link-cli)
  on any of them, atomic;
- **types** `Type -> SubType -> … -> Value` and **permissions** stored as
  links;
- a **links server** that speaks the protocol of `clink --serve`, with
  authentication and subscriptions;
- a **synced client** that keeps the part of the links its user may read,
  writes to it at once and sends the writes in order, like Meteor's minimongo
  or deep-foundation's minilinks.

Every layer is a decorator over the same interface, so they stack and can be
replaced: the server takes any storage, the client is a storage itself, and
the query engine and the type system run on a client as on a server.

```js
import {
  connectInProcess,
  createLinksServer,
  createMemoryLinks,
  createSyncedLinks,
  linksToLino,
} from '@link-foundation/ui-links';

const server = createLinksServer({
  links: createMemoryLinks(),
  autoCreate: true,
});
const client = createSyncedLinks({ transport: connectInProcess(server) });
await client.query('() ((p: x y))');
linksToLino(client); // (1: 2 3)\n(2: 2 2)\n(3: 3 3)
```

The runnable examples in the repository are `examples/ui-links-permissions.mjs`
(types, permissions, two users), `examples/ui-links-tcp.mjs` (TCP, link-cli's
own client, pushes) and `examples/ui-store-links.mjs` (a UI document of
`@link-foundation/ui-store` in SQLite links).

## The storage interface

A link is `{ id, from_id, to_id }`: an address, a source and a target, all
integers (0 is "none"). A storage has the interface of doublets-web's
`UnitedLinks`:

| Method                    | Does                                                     |
| ------------------------- | -------------------------------------------------------- |
| `create()`                | a new link `(id: 0 0)`; its address                      |
| `update(id, source, to)`  | sets the source and the target                           |
| `delete(id)`              | removes the link (not the links that use it)             |
| `count(query?)`           | how many links match                                     |
| `each(handler, query?)`   | calls `handler(link)` per match until it returns `BREAK` |
| `createAt(id)` (optional) | a new link at a free address (memory, its decorators)    |

A query is `{ id, from_id, to_id }` or `[id, source, target]`; a missing
part, `*` or `ANY` matches anything. The constants are those of doublets
(`NULL`, `ANY`, `CONTINUE`, `BREAK`, `SKIP`, `ITSELF`, `ERROR`). Errors are
`LinksError`s with a `code`: `not-found`, `exists`, `bad-request`,
`bad-reference`, `forbidden`, `bad-reply`, `offline`, `closed`, `remote`.

Helpers over any storage: `allLinks(links, query?)`, `getLink(links, id)`,
`exists`, `search(links, source, target)`, `ensureCreated(links, id)`.

## Storages

- `createMemoryLinks()`: a map with source and target indexes. Freed
  addresses are reused, the last freed first, like doublets-web.
- `createSqlLinks(db, { table? })`: a table `(id, source, target)` with
  indexes, in any database with `exec(sql)` and `prepare(sql)` returning
  statements with `run`, `get` and `all`, i.e. `node:sqlite`'s
  `DatabaseSync` (Node.js, Deno and Bun) or better-sqlite3. It is persistent
  itself.
- `openDoubletsWebLinks()` / `fromDoubletsWeb(module, unitedLinks)`: the
  doublets-web WebAssembly store (an optional peer dependency, loaded only
  when called). Bun 1.4 cannot load its module; Node.js and Deno can.
- `persistLinks(links, adapter)`: loads what an adapter keeps into a storage
  (usually the memory one), then writes every change through; `flush()`
  waits for the writes. The adapters are
  `localStorageAdapter(storage, prefix?)` (one key per link),
  `indexedDbAdapter(indexedDB, name)` (one record per link) and
  `linoTextAdapter({ read, write })` (the whole store as
  `(id: source target)` lines, link-cli's format).

## Decorators

Each takes a storage and returns one with the same interface:

- `observe(links, listener)`: `listener({ before, after })` after each write;
- `withCascade(links)`: `delete` also deletes every link that uses the
  deleted one, transitively (`dependentsOf`, `deleteCascade`);
- `withPermissions(links, policy, subject)`: see "Permissions".

`netChanges(changes)` folds recorded changes into one change per link,
`snapshot(links)` copies every link and `rollback(links, changes)` undoes
recorded changes, last first.

## Names and Links Notation

`createNames()` is link-cli's names sidecar: one name per link, one link per
name (`setName`, `getName`, `getByName`, `removeName`). `linksToLino` and
`linksFromLino` write and read `(id: source target)` lines, with names when
given; `namesToLino` and `namesFromLino` do the same for names. `parseLino`,
`formatLino`, `encodeBinary` and `decodeBinary` are the text and binary forms
of [links-notation](https://github.com/link-foundation/links-notation)'s
`BinaryLinoCodec`, in the document model of `@link-foundation/link-cli-client`
(a reference is a string, a link is `{ id, values }`).

## Substitution queries

`runQuery({ links, names?, autoCreate? }, query)` runs link-cli's query
language: a restriction and a substitution, with numbers, names, `$variables`,
`*`, nested links and explicit indexes.

```text
() ((1 1))                  create (reusing an equal link)
((1 2)) ()                  delete, with every link that uses it
((1: 1 1)) ((1: 1 2))       update
(($i: $s x)) (($i: $s x))   read: the same restriction and substitution
```

A query is atomic: when it fails, every write and new name is undone. The
result is the net change of every link it touched, a read reported as a change
whose `before` and `after` are equal. `transact(context, fn)` runs any writes
the same way.

## Types

`typeSystem(links, typeMarkers(links, names))` keeps types in the style of
link-cli's pinned types, extended to a hierarchy of any depth:

- the type of a link is its source: `(v: S x)` is a value of type `S`;
- the root is the point `(Type: Type Type)`; a sub-type is `(S: T S)`, a
  value of `T` that points at itself;
- more parents (multiple inheritance) are pairs `(p: S T2)` marked
  `(m: Extends p)`.

`define(parent, ...more)` makes a type, `instance(type, target?)` a value;
`isA` (the type itself or of it), `isOf` (strictly of it), `parentsOf` and
`ancestorsOf` follow sources and `Extends` links, cycles included.

## Permissions

An optional layer over any storage. A rule is a pair `(g: Subject Object)`
marked `(r: AllowRead g)` or `(r: AllowWrite g)`: the subjects that are
`Subject` (the subject itself or a link of that type) may read, or read and
write, the links of type `Object` (its values and sub-types). The marker
`Anything` matches every subject or every link. The markers are points of the
data (`permissionMarkers(links, names)`); the rules live with the data or in a
storage of their own.

```js
const types = typeSystem(links, typeMarkers(links, names));
const markers = permissionMarkers(links, names);
allow(links, markers, 'write', Admin, markers.anything);
allow(links, markers, 'write', User, Note);
allow(links, markers, 'read', User, Public);
const policy = createPolicy({ rules: links, markers, types });
const asAlice = withPermissions(links, policy, alice);
```

`withPermissions` hides what the subject may not read (a hidden link is as
missing as a deleted one) and refuses a write it may not do with `forbidden`,
the storage unchanged. An update needs the right to write the link before and
after. A link the subject created through the view is its own while it has no
type (its source is 0); `forget(id)` drops that claim when the link is gone.
The links that wire the type hierarchy are of type `Extends`, so whoever may
write them may change the hierarchy: give `Anything` writes to administrators
only, or keep the rules in a storage of their own.

## The links server

`createLinksServer({ links, names?, policy?, authenticate?, autoCreate? })`
answers the LinksOperation protocol of `clink --serve` (link-cli's
`docs/protocol/links-operations.txt`) over any storage. `server.session({
subject?, onPush? })` opens a connection; `session.request(text)` answers LiNo
text and `session.requestBinary(bytes)` binary packets.

```text
(count: (i s t))          -> (count: N)
(each: (i s t))           -> (i: s t) per link, by address
(create: (s t))           -> () ((i: s t))
(update: (i s t))         -> ((i: s t)) ((i: s2 t2))
(delete: i)               -> ((i: s t)) () per deleted link, users included
(get-name: i)             -> (name: 'text') or nothing
(set-name: (i 'text'))    -> (link: i)
(get-by-name: 'text')     -> (link: i) or nothing
(remove-name: i)          -> nothing
()                        -> every link, names for named addresses
anything else             -> a substitution query: its changes
```

Two extensions serve clients that keep a partial copy:

```text
(auth: token)             -> (subject: i), or an error
(subscribe: (i s t))      -> (subscription: n); later, pushed to this
                             session only: (notify: n) and the changes
                             other sessions made to matching links
(unsubscribe: n)          -> nothing
```

An error is `(error: 'message')`. Every request is atomic and runs as the
session's subject: with a policy, a session sees and changes only what its
subject may. References are checked, and failed requests undone, in the
storage under the permission view, so a subject may use a type it may not
read (and so may learn that an address exists).

`listenLinks(server, { port?, host?, maxMessageBytes? })` from
`@link-foundation/ui-links/tcp` serves it on TCP (Node.js), framed like
`clink --serve` (`encodeMessage`, `createMessageReader`): the
`connectTcp` client of `@link-foundation/link-cli-client` talks to it, and
`connectLinks(address)` is a transport that also takes the pushes.

## WebSocket transport

`connectWebSocket(url, { binary? })` from
`@link-foundation/ui-links/websocket` uses the runtime's native `WebSocket`
(browser, Node.js 22+, Deno or Bun). It returns the same text transport interface
as `connectInProcess`; `binary: true` converts requests, replies and pushes
through the official `links-notation` binary codec.

```js
import { createSyncedLinks } from '@link-foundation/ui-links';
import { connectWebSocket } from '@link-foundation/ui-links/websocket';

const transport = await connectWebSocket('ws://127.0.0.1:8080', {
  binary: true,
});
const client = createSyncedLinks({ transport });
await client.subscribe([]);
```

On Node.js, `listenLinksWebSocket(server, { port?, host?, maxMessageBytes?,
subject? })` from `@link-foundation/ui-links/websocket-server` returns
`{ port, host, address, url, close }`. It uses `ws` (MIT), isolated in the server
entry point so browser imports never load Node modules. The defaults are a
random port on `127.0.0.1`, a 64 MiB message limit, and a null subject.
Authentication and permissions use the same session protocol as TCP.

Each WebSocket **message** is exactly one request or reply: text is a LiNo
document, binary is exactly one `encodeBinary` packet (no TCP dot terminator
or extra length prefix). Replies arrive in request order; pushes begin with
`(notify: n)` and do not consume a waiting reply. Replies use the request's
frame type, and pushes use the recipient's last request's frame type and binary
codec options. Incomplete or concatenated binary packets close the socket with
code 1002; oversized messages close it with code 1009. Socket errors and closure
reject every waiting request and subsequent sends with `LinksError('offline')`.
The synced client retains its in-memory outbox and can replay it with
`client.connect(await connectWebSocket(url))`; persistent outboxes and reconnect
resynchronisation are tracked separately in #114.

Run `node examples/ui-links-websocket.mjs` for the TCP example's WebSocket twin.
The example runs in the runtime CI matrix; `tests/ui/links-websocket.e2e.mjs`
syncs two browser tabs through this server in text and binary modes.
The framing proposal is tracked in link-foundation/link-cli#30.

## The synced client

`createSyncedLinks({ transport?, cache? })` keeps a copy of part of the server
in `cache` (a memory storage by default) and has the storage interface itself:

- `load(restriction)` reads links into the cache; `subscribe(restriction)`
  does too and keeps them up to date from the pushes; `unsubscribe(id)`.
- Writes change the cache at once (`origin: 'local'`) and wait in an outbox
  that sends them in order; `flush()` resolves when they are answered,
  `pending` counts them. Offline, they wait until `connect(transport)`.
- A created link has a temporary address counted down from `MAX_ADDRESS`;
  when the server answers, it and every link that used it move to the real
  address (`onRemap`, `resolve(id)`, `isTemporary(id)`).
- A write the server refuses is undone in the cache (`origin: 'rollback'`)
  and reported to `onError(error, write)`; the writes after it still go.
- `query(text)` runs a substitution query on the server after the queued
  writes; its changes come into the cache.
- `onChange({ before, after, origin })` reports every change of the cache.

A transport is `{ send(text): Promise<text>, onPush?(listener), close?() }`:
`connectInProcess(server, { subject? })` for a server in the same process,
`await connectLinks('host:port')` from `@link-foundation/ui-links/tcp` over
TCP.

## Compatibility with link-cli

The protocol, the query language, the names sidecar and the text format are
link-cli's; `tests/fixtures/links-operations.txt` is link-cli's protocol
conversation, replayed by the tests. The differences:

- `set-name` answers `(link: i)` with the address it named; link-cli's
  conversation shows another number there.
- Addresses follow the storage: in link-cli's README example
  `(((m a) (m a))) (((p a) (p a)))` the new `p` is link 1; here the update
  deletes link 4 and `p` takes the freed address 4 (the memory storage, like
  doublets-web, reuses the last freed address first).
- `auth`, `subscribe`, `unsubscribe` and the permission layer are extensions;
  link-cli has none of them yet.
- A client that did not subscribe keeps what it loaded, even after other
  clients changed it, until it loads again.
- A link a subject created is its own (while untyped) for the session that
  created it.

## License

[Unlicense](LICENSE)
