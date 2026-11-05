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
  createLinksNames,
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

### Names in the data storage

Pass `names: createLinksNames(links)` to `createLinksServer` to store names
with the data instead of in a sidecar. It implements the same `setName`,
`getName`, `getByName`, `removeName` and `entries` interface; queries,
`linksFromLino` / `linksToLino` and `namesFromLino` / `namesToLino` accept it.
Reopening `createLinksNames` on persisted doublets recovers the names without
another file. The sidecar remains the default for protocol compatibility.

```js
const links = createMemoryLinks();
const names = createLinksNames(links);
const server = createLinksServer({ links, names, autoCreate: true });
const transport = connectInProcess(server);
const client = createSyncedLinks({ transport });
await client.query('() ((greeting: greeting greeting))');
client.names.getByName('greeting'); // the address in the client cache
```

The encoding follows link-cli's Unicode string/name approach, using doublets
for both text and the binding. It has its own portable layout, without
link-cli's pinned addresses or external numeric references. The reserved
namespace shape is `(r: 0 r)` with bit markers `(z: r r)` and `(o: r z)`.
A right list of bit-marker addresses, terminated by `r`, stores UTF-16 code
units in most significant bit order. `(p: data text)` marked `(n: r p)` binds
the text to a link. The complete three-marker shape identifies a namespace;
applications using this names store must reserve that shape. Numeric
addresses are allocated normally. Renames remove old name marks; shared text
and binding doublets remain available for reuse. Cascading deletion of a data
link removes its bindings. Plain storage deletion follows the storage's usual
non-cascading semantics; dangling bindings do not resolve to names.

A permission view must allow reading the named link **and every doublet in
its encoding** to resolve the name. Name writes use the same view, so grant
access to the namespace, sequence and binding links as appropriate. Server
name operations and query name creation participate in the request's atomic
transaction, including rollback on denied metadata writes. `withLinks(view)`
rebinds the names interface to another view; `dependencies(ids)` returns the
readable encoding links needed for those addresses. `bindings(ids)` selects
only their name marks, without shared text nodes.

The protocol extensions `(load: restriction)` and `(name-links: (ids…))`
return data with its readable name encoding and the encoding alone,
respectively. `load` answers `(links: (...))` and `(names: (...))`.
The synced client loads these doublets into the same cache and exposes
`client.names`. Partial subscriptions include name changes even when the
name doublets themselves do not match the subscribed restriction. Renames,
removals and reassignment update other subscribed clients. Encoding links
are regular cached links and count toward the cache's `count()`.

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

`allow()` reuses an existing rule pair and mark. Repeating a grant leaves the
store unchanged, and a type link that already represents the rule pair keeps
its address when the data is imported into clink.

`withPermissions` hides what the subject may not read (a hidden link is as
missing as a deleted one) and refuses a write it may not do with `forbidden`,
the storage unchanged. An update needs the right to write the link before and
after. A link the subject created through the view is its own while it has no
type (its source is 0); `forget(id)` drops that claim when the link is gone.
The links that wire the type hierarchy are of type `Extends`, so whoever may
write them may change the hierarchy: give `Anything` writes to administrators
only, or keep the rules in a storage of their own.

A reference needs a right too: without it an address answers `Link not found`,
whether a hidden link is there or nothing is. A subject may refer to what it may
read, to itself, to the `Object` of a rule it holds (`User` writes `Note` is
enough to type links as `Note`), and to what a rule marked
`(r: AllowReference g)` covers: `Object` and the links of type `Object`.

```js
allow(links, markers, 'reference', User, Secret); // may link to, not read
```

That rule does not allow reading the link. A reference a link already holds may
stay, and choosing the address of a new link is a reference as well. The name of
a link the subject may not refer to answers as an unknown name.
`allow(links, markers, 'reference', markers.anything, markers.anything)` lets
every subject refer to everything, as before. A custom policy without
`canReference` allows references to readable links only. The decision, and what
it does not hide, are in
[the case study](../../docs/case-studies/issue-119/README.md).

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
subject may. A reference it may not make answers `Link not found`, as a
missing address does. Failed requests are undone in the storage under the
permission view.

With `createPolicy`, rule and hierarchy writes through the server also push
links that become readable as creations and links that become hidden as
deletions, in one notification per subscription per request. Rule changes
refresh only subjects they mention (including instances and subtypes);
`Anything` rules and hierarchy changes can affect every subscriber. A
server-local cache shares readable types between sessions of the same subject.
The ordinary permission view still reads live rules. Direct storage mutations
outside server requests do not publish notifications.

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
The synced client retains its outbox and can replay it with
`await client.connect(await connectWebSocket(url))`. Use `openSyncedLinks` below
to keep queued writes across reloads.

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
  Server replies, pushes and loads update the confirmed state beneath queued
  edits, so refusing an edit preserves newer observations and later edits.
  Writes depending on a refused create are refused too, without leaving
  temporary links in the cache.
- `query(text)` runs a substitution query on the server after the queued
  writes; its changes come into the cache.
- `onChange({ before, after, origin })` reports every change of the cache.
- `await connect(transport)` replays queued writes, restores subscriptions and
  on reconnect replaces the cache with the server's current readable links, reporting
  differences with `origin: 'remote'`. This includes removal of deleted or
  newly unreadable links. The server has no version log, so reconnect uses
  a full readable snapshot, including links outside previous restrictions.
  Subscriptions continue to deliver only their matching changes. The first connection keeps the cache partial until `load` or `subscribe`.
  Subscription IDs belong to the client and remain valid across reconnects and reloads.

For a durable offline client, use the async opener with one of the persistence
adapters. It uses `persistLinks` for the cache and stores its outbox, rollback
records, temporary-address counter, remaps and subscription restrictions as
nested Links Notation through the same adapter:

```js
import {
  openSyncedLinks,
  localStorageAdapter,
} from '@link-foundation/ui-links';

const client = await openSyncedLinks({
  adapter: localStorageAdapter(localStorage, 'my-client:'),
});
const id = client.create();
client.update(id, id, id);
await client.flush(); // durable even offline; safe to recreate the client
// After a reload, open with the same adapter, then:
await client.connect(transport);
client.resolve(id); // the server's real address, retained across reloads
```

`openSyncedLinks({ adapter, transport?, cache? })` restores before connecting;
`cache` must be empty. `flush()` waits for replay, reconnect refresh and adapter
writes; offline it waits only for persistence. Await it before an intentional
reload. Custom adapters add `loadState()` (LiNo text or null, possibly a promise)
and `saveState(text)` to the persistence interface, and include checkpoint
writes in `flush()`. localStorage uses the reserved `prefix + 'sync'` key;
IndexedDB upgrades to version 2 with a `sync` object store; the text adapter
adds a nested `sync` record alongside the link records. Existing cache data
loads without a checkpoint. Use one active client per adapter namespace.

The server's answer wins: refused writes retain the existing rollback and error
notifications, then reconnect reconciles against the readable server snapshot.
Rollback records are rebased on server observations and persisted with the
remaining queue, so that a reload preserves the same confirmed state.
Acknowledged creates keep their remap before a self-reference update, so that
step can resume after reload. Delivery remains at least once: a connection lost
after the server commits but before its acknowledgement can replay a write
(the protocol has no request deduplication). Adapter flush is the durability
boundary; separate cache/checkpoint records do not promise an atomic snapshot
if the process crashes during a write.

A transport is `{ send(text): Promise<text>, onPush?(listener), close?() }`:
`connectInProcess(server, { subject? })` for a server in the same process,
`await connectLinks('host:port')` from `@link-foundation/ui-links/tcp` over
TCP.

## Triplets

`withTriplets(links, { names?, markers? })` is a view of triplets
`(index: type from to)` over the doublets of any storage. The encoding is
link-cli's ([`docs/TRIPLETS.md`](https://github.com/link-foundation/link-cli/blob/main/docs/TRIPLETS.md)),
so a store written by one reads the same in the other. The view keeps the
storage interface, for the doublets underneath, and adds:

- `createTriplet(type, from?, to?)`, `createTripletPoint()` (its own type),
  `createTripletPointAt(address)`;
- `getTriplet(index)`, `isTriplet(index)`, `roleOf(address)`;
- `updateTriplet(index, type, from, to)` → the triplet before;
- `deleteTriplet(index)` → every triplet removed, as deleting one removes
  those that use it as a type or a part;
- `eachTriplet(query?)`, `countTriplets(query?)`, where a query is
  `{ index, type, from, to }` or an array in that order.

`withTripletPermissions(view, policy, subject)` keeps a subject to what it may
read and write. `runQuery` reads three-part links when `context.links` is such
a view:

```text
() ((3: 3 0 0))                   create a point at an address
() ((Person 0 0))                  create, with the name of its type
((10: 4 5 6)) ((10: 4 6 5))       update
((10: 4 5 6)) ()                  delete
(($i: Person $f $t)) (($i: Person $f $t))   read
```

### The triplet mode of the server

`createLinksServer({ links, names?, triplets: true })` speaks the conversation
of link-cli's [`docs/protocol/triplets.txt`](https://github.com/link-foundation/link-cli/blob/main/docs/protocol/triplets.txt),
in text and in the binary protocol with every option, like
`clink --serve --triplets`. `tests/triplets-server.test.js` replays a copy of
that file against it. `server.triplets` is the view.

### The synced triplets client

`createSyncedTriplets({ transport? })` keeps a copy of part of such a server,
as `createSyncedLinks` does for links, and its `create`, `update`, `delete`,
`count` and `each` work on triplets:

```js
import { createSyncedTriplets } from '@link-foundation/ui-links';
import { connectLinks } from '@link-foundation/ui-links/tcp';

const client = createSyncedTriplets({
  transport: await connectLinks('127.0.0.1:8080'),
});
await client.subscribe();
const person = client.createTripletPoint();
const alice = client.createTriplet(person);
await client.flush();
client.resolve(alice); // its real address
client.eachTriplet({ type: client.resolve(person) });
client.deleteTriplet(alice);
```

- `getTriplet`, `isTriplet`, `eachTriplet`, `countTriplets`, `count` and `each`
  read the cache; `load(restriction)`, `remoteCount(restriction)` and
  `subscribe(restriction)` ask the server, a restriction being
  `[index, type, from, to]`. `unsubscribe(id)` stops the pushes.
- Writes change the cache at once and wait in an outbox; `flush()` resolves
  when they are answered, and `pending` counts them. A new triplet has a
  temporary address until the server answers: `isTemporary`, `resolve` and
  `onRemap(listener)` tell about it, and the old address keeps working in the
  calls of the client.
- A refused write is undone (`origin: 'rollback'`) and told to
  `onError(listener)` with the words of the server. A later write that uses a
  triplet whose create was refused is refused with it. Reads are what the server
  said with the queued writes on top, so an undo cannot bring back an old value.
  `onChange(listener)` gets every change of the cache.
- `query(text)` runs a substitution query after the queued writes, and brings
  its changes into the cache.
- Writes wait without a connection; `connect(transport)` sends them, subscribes
  again and reads every readable triplet again.

The copy lives in memory: it has no persistence yet, unlike `openSyncedLinks`.

## DeepClient and minilinks

`createDeepClient(synced)` adapts the synced triplets client to Deep's data API.
It adds no React or Apollo runtime dependency. `deep.ml` and `deep.minilinks`
are the same local collection. The runnable
[Deepcase example](../../examples/deepcase/README.md) imports the real upstream
main graph and React hooks and connects them to clink through this API.

```js
import {
  createDeepClient,
  createSyncedDeepLinks,
} from '@link-foundation/ui-links';

// clink --db deep.links --serve 127.0.0.1:3006 --graphql --deep-package core.json
const synced = createSyncedDeepLinks({
  url: 'http://127.0.0.1:3006/v1/graphql',
});
const deep = createDeepClient(synced);
await deep.guest();
const type = await deep.id('@deep-foundation/core', 'Type');
const {
  data: [link],
} = await deep.insert({
  type_id: type,
  string: { data: { value: 'Hello' } },
});
const subscription = deep.subscribe({ type_id: type }).subscribe({
  next: ({ data }) => console.log(data),
  error: console.error,
});
await deep.update({ link_id: link.id }, { value: '' }, { table: 'strings' });
await deep.select({ _not: { string: { value: { _eq: 'Hello' } } } });
await deep.delete(link.id);
subscription.unsubscribe();
deep.close();
synced.close();
```

- `select`, `insert`, `update`, `delete` resolve to `{ data, loading: false }`;
  refused writes reject and remove their optimistic changes. `subscribe`
  delivers this shape through an observable with idempotent `unsubscribe()`.
  `close()` disposes the adapter's listeners and subscriptions; its caller
  still owns the underlying synced client's connection.
- Inserts accept nested `type`, `from`, `to`, `in`, `out`, `typed` data and
  `string`, `number`, `object` value data. Value tables use `link_id` and
  `value`. Numbers must be finite; objects must be JSON serializable.
  Explicit insert ids are refused: the synced client owns address allocation.
- Queries support `_and`, `_or`, `_not`, `_eq`, `_in`, `_is_null` and all six
  link relations (`from`, `to`, `type`, `in`, `out`, `typed`). The local engine
  also supports inequalities, `_nin`, `_contains`, ordering, distinct values,
  offset and limit. Unknown comparisons reject, including on an empty cache.
  `{ remote: false }` queries only the cache. `{ aggregate: 'count' }` counts
  matching rows. `_id: ['package', 'name']` expands a cached package path.
- `createMinilinks()` can be used independently: `add`, `update`, `remove`,
  `query`, `subscribe`, and `apply(rows, name)`. Applies retain shared rows
  until every owning apply releases them. Rows expose relation getters,
  `value`, `toPlain()` and `inByType`/`outByType`; the collection exposes
  `byId`, `byFrom`, `byTo`, `byType` and its event emitter.
- Temporary addresses and dependent references follow `synced.resolve`.
  Named applies survive remapping; refused creates leave no ghost rows.
  `idLocal(package, ...names)` uses cached string names;
  `await id(package, ...names)` loads the readable network first. A trailing
  `true` permits a missing path and returns 0.
- On a regular `createSyncedTriplets`, queries fetch readable candidates with
  an identity substitution and evaluate the complete predicate locally.
  Values are actual triplets: namespace/kind markers, linked UTF-16 bit lists,
  and owner-to-text links. They survive another client's reload and owner
  deletion cascades through the storage's triplet rules.
- `can(object, subject, action)` delegates to `options.policy` on the LiNo
  transport, including inherited types. Actions are `read`, `write`,
  `reference`, or numeric ids mapped by `options.actions`. With the GraphQL
  transport it queries clink's permission grants; `read`/`write` resolve
  the core `AllowSelect`/`AllowUpdate` ids. A server without policy grants
  answers false. A permission check never substitutes for server enforcement.

`createSyncedDeepLinks` uses clink 2.1.1's `/v1/graphql` endpoint and sends
normalized Hasura predicates. Its ids are **Deep ids**, mapped by the server;
use a separate synced client for physical LiNo addresses. Native strings,
numbers and objects are linked values in clink, independent of the LiNo-only
UTF-16 encoding. It supports bearer tokens, extra headers, injected fetch and
WebSocket implementations, and both `graphql-ws` and `graphql-transport-ws`
protocols. Optional `trace(operation)` observes HTTP requests; it is off by
default. `guest()` obtains a token. Mutations use the existing optimistic
triplets outbox; queued native values flush after owner ids remap. Call
`await synced.reconnect()` after a disconnection, then `await deep.flush()` to
flush value edits as well.

This is the data API subset, not the entire deeplinks SDK: remote code
execution, handler installation, the full Next app and arbitrary GraphQL
selection generation are not provided. The optional example bridges the
original Apollo React hooks to the subset and verifies a real rendered graph.

## Compatibility with link-cli

The protocol, the query language, the names sidecar and the text format are
link-cli's; `tests/fixtures/links-operations.txt` is link-cli's protocol
conversation, replayed by the tests. Permissions, authentication and
subscriptions are shared with link-cli since Rust 1.3.0
([permissions](https://github.com/link-foundation/link-cli/issues/149),
[subscriptions](https://github.com/link-foundation/link-cli/issues/150)).
The remaining differences by design:

- `set-name` answers `(link: i)` with the address it named; link-cli returns
  the address where its names store keeps the name. Clients need only the
  successful acknowledgement.
- Addresses follow the storage: in link-cli's README example
  `(((m a) (m a))) (((p a) (p a)))` the new `p` is link 1; here the update
  deletes link 4 and `p` takes the freed address 4 (the memory storage, like
  doublets-web, reuses the last freed address first).
- `load` and `name-links` are ui-links extensions for names stored as links.
  The synced client falls back to `each` and sidecar name resolution when a
  server does not implement them. The two name encodings are independent.

Both servers keep an untyped new link owned by the session that created it.
Between connections, a client that did not subscribe keeps what it loaded
until it loads again. Reconnect refreshes all readable links.
Ownership is shared behavior, rather than a protocol deviation.
Reference permissions (`AllowReference`, see [Permissions](#permissions)) are
also shared with clink 2.1.1, following
[link-cli#161](https://github.com/link-foundation/link-cli/issues/161).

### Verify against a released server

```sh
CARGO_BUILD_JOBS=1 cargo install link-cli --version 2.1.1 --locked
CLINK=clink node --test --test-timeout=30000 packages/ui-links/tests/client.test.js packages/ui-links/tests/clink.test.js
node examples/ui-links-permissions.mjs --server clink
```

`CLINK` selects an executable path (default `clink` for the example). The
shared client contract uses identical data, names, rules and tokens against
both servers, with rules in the data and in a separate file. It checks guest
and authenticated reads, refused writes and cache rollback, temporary-address
remapping, subscription delivery, permission loss, unsubscribe, and reference
grants that leave their targets unreadable. The synced
triplets client does its creates, reads, updates, deletes and queries through
`clink --serve --triplets` the same way. Without
`CLINK`, the external-server tests visibly skip; CI installs clink 2.1.1 and
runs them on Node.js, Bun and Deno, then runs the permissions example against
both servers. Each fixture uses a temporary directory and an ephemeral local
TCP port, and closes its connections and server before removing its own data.
The latest C# release (4.0.6) predates permissions and subscriptions; a C#
release containing those operations can use the same client contract.

## License

[Unlicense](LICENSE)
