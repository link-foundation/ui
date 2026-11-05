# Issue 101 — solutions per requirement

For each requirement of [requirements.md](requirements.md): what was built or
planned, the alternatives and libraries considered, and the evidence. The
evidence is a test (run by `npm test`, and in CI on Node.js, Bun and Deno), a
runnable example whose output is kept in [`data/`](data/), a commit of pull
request [#108](https://github.com/link-foundation/ui/pull/108), or a created
issue. The research behind the choices is in
[research/library-survey.md](research/library-survey.md),
[research/deep-foundation.md](research/deep-foundation.md) and
[research/link-cli.md](research/link-cli.md).

This records the original MVP and its plan. The
[issue-109 completion audit](../issue-109/README.md) supersedes the planned
work and historical limits below: accepted follow-ups are implemented,
including WebSockets, durable sync, live documents, permission-change pushes,
names as links, released-clink connectivity, triplets and Deep. Browser
SQLite/OPFS was explicitly rejected in #111.

## R1–R6: `setPositional` in ui-store (the issue body)

Built in commit `4c2bcd8`, as the issue specified.

| ID  | Solution                                                                                                                                                                                                                                                | Evidence                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | `{ op: 'setPositional', id, values }` in `packages/ui-store/src/ops.js`; its inverse is a `setPositional` with the old values. Positional values are atoms (docs/spec/elements.md), so links among them are refused with `bad-value`.                   | `packages/ui-store/tests/set-positional.test.js`: "is undone and redone exactly", "rolls back inside a failed transaction", "checks its input before changing anything"        |
| R2  | `store.setPositional(id, values)` and its declaration in `packages/ui-store/src/index.d.ts`.                                                                                                                                                            | the same file, "changes the positional values with one update event"; the declarations are type-checked by Deno in CI                                                          |
| R3  | One `update` event without `prop`, with `before` and `after` the old and new values.                                                                                                                                                                    | "changes the positional values with one update event", "keeps the ID, the place, the properties and the children", "sets the values of an anonymous element and clears them"   |
| R4  | `(setPositional ID VALUES…)` in `log-lino.js`, read and written with `parseLinks`/`formatLinks`.                                                                                                                                                        | "round-trips through the log as Links Notation and replays", "rejects a setPositional link without an id"                                                                      |
| R5  | `bindStore` in ui-config makes one transaction with origin `config` and one `setPositional` op instead of remove and insert.                                                                                                                            | `packages/ui-config/tests/bind-store.test.js`: "changes positional values with one setPositional operation", "keeps ids, children and order when the positional values change" |
| R6  | Tests above, the operation table of `packages/ui-store/README.md`, the one changeset of the pull request, `.changeset/ui-links-package.md` (`ui-links: minor`, `ui-store: minor`, `ui-config: patch`; the check allows one changeset per pull request). | CI of the pull request: tests, lint, format and duplication checks                                                                                                             |

## R7–R9: one associative storage interface, many storages

**Solution.** A new package, `@link-foundation/ui-links` (commits `b264603`,
`c27de4a`, `49620b3`). The interface is doublets-web's `UnitedLinks`
(`create`, `update`, `delete`, `count`, `each` with `ANY` queries and
`BREAK`); a link is `{ id, from_id, to_id }`. Storages:

- memory (`createMemoryLinks`), which reuses freed addresses like doublets-web;
- doublets-web itself (`openDoubletsWebLinks`, an optional peer dependency);
- SQL (`createSqlLinks`) over any database with `exec`/`prepare`:
  `node:sqlite` on Node.js, Deno and Bun, or better-sqlite3;
- IndexedDB, `localStorage` and Links Notation text as persistence adapters
  (`persistLinks` with `indexedDbAdapter`, `localStorageAdapter`,
  `linoTextAdapter`), because doublets-web keeps nothing itself.

The storages are associative in the same way (R9): link-cli's substitution
query language (`runQuery`) runs over any of them, atomically, and the names
sidecar and the text format are link-cli's. ui-store writes its documents into
any of them (`writeDocumentLinks`/`readDocumentLinks`, commit `ce1c2a3`), so
"ui store uses doublets-web and other storages" (R7) holds for its documents.

**Alternatives.** RxDB has a storage interface of its own, but its IndexedDB,
OPFS and SQLite storages are premium; TinyBase persisters are key-value and
not associative; wa-sqlite and sqlite-wasm are SQL engines, not link stores
(the browser SQLite storage on OPFS is planned:
[ui#111](https://github.com/link-foundation/ui/issues/111)). Taking
doublets-web's interface makes the native store and every other one
interchangeable (R8).

**Evidence.**

- `packages/ui-links/tests/storages.test.js` runs the same tests on memory,
  SQLite and doublets-web (doublets-web is skipped on Bun 1.4, which cannot
  load its module; the reason is in the test name);
- `persist.test.js`: "keeps links in localStorage / IndexedDB / as Links
  Notation text / in a SQLite file";
- `query.test.js`: create, read, update, delete, variables, wildcards, nested
  links, and "changes nothing when a query fails";
- `packages/ui-store/tests/links-adapter.test.js`: a document through memory,
  SQLite, IndexedDB and a links server;
- [`data/example-ui-store-links.txt`](data/example-ui-store-links.txt): a UI
  document in SQLite links;
- [`data/test-node-ui-links.txt`](data/test-node-ui-links.txt),
  [`data/test-deno-ui-links.txt`](data/test-deno-ui-links.txt) and
  [`data/test-bun-ui-links.txt`](data/test-bun-ui-links.txt): the package's
  tests on the three runtimes.

## R10–R12: a synced client, partial data, streaming by access

**Solution.** `createSyncedLinks` is a storage itself (the same interface)
that keeps a part of the server in a cache:

- `load(restriction)` and `subscribe(restriction)` fill it, and pushes keep a
  subscription up to date (R11: the client's part and the server form one
  network);
- writes change the cache at once and wait in an ordered outbox; a created
  link has a temporary address that moves to the real one when the server
  answers, together with every link using it; a refused write is rolled back
  (R10: Meteor-like latency compensation, minilinks' negative ids);
- `query(text)` runs a substitution query on the server after the queued
  writes;
- the server runs every request as the session's subject, so answers and
  pushes hold only what the subject may read (R12).

**Alternatives.** The three families of optimistic writes are surveyed in
[research/library-survey.md](research/library-survey.md#notes): replay or
rebase (Meteor, Replicache, Zero, InstantDB), assumed-state compare-and-swap
(RxDB, CouchDB) and CRDTs (Yjs, Automerge, TinyBase). Replay suits links: a
write is small, the server's rules may refuse it, and its answer wins. Reads
are filtered (as in InstantDB, Hasura and Supabase), not rejected as in
Firestore, because a client that works "like all links are local" cannot know
in advance what it may read.

**Evidence.** `packages/ui-links/tests/client.test.js` ("writes
optimistically and moves temporary addresses", "receives what other clients
change in a subscription", "queues writes offline and sends them on connect",
"keeps writes when the transport fails", "rolls back what the server
refuses", "works over TCP, with pushes to a synced client"), and
[`data/example-ui-links-tcp.txt`](data/example-ui-links-tcp.txt) (a temporary
address `4294967289` remapped to `2`, then a push).

**Planned.** WebSocket transport for browsers
([ui#110](https://github.com/link-foundation/ui/issues/110)), a persistent
outbox and resync after a reconnect
([ui#114](https://github.com/link-foundation/ui/issues/114)), a live ui-store
document over the client
([ui#115](https://github.com/link-foundation/ui/issues/115)), and pushes when
rules or types change what is readable
([ui#113](https://github.com/link-foundation/ui/issues/113), see "Known
limits").

## R13, R14, R16: the server with permissions, the type system, deep-foundation adapted

**Solution.**

- **Types (R14)** — `typeSystem`: the type of a link is its source; the root
  is `(Type: Type Type)`; a sub-type is `(S: T S)`, which is link-cli's pinned
  type `(n: 1 n)` generalised to any parent, so the depth is unbounded; more
  parents are `(p: S T2)` pairs marked `(m: Extends p)` (multiple
  inheritance). `isA`, `ancestorsOf` and the rest follow cycles safely.
- **Permissions (R13)** — rules are links: `(g: Subject Object)` marked
  `AllowRead` or `AllowWrite`, with `Anything` for every subject or object.
  `withPermissions(links, policy, subject)` is a decorator that hides what
  the subject may not read and refuses forbidden writes, leaving the storage
  unchanged. The rules may live with the data or in a storage of their own
  ("same or separate links file").
- **The server (R13)** — `createLinksServer` answers the operations of
  `clink --serve` over any storage, plus `auth`, `subscribe` and
  `unsubscribe`, in process or over TCP (`listenLinks`).
- **deep-foundation, adapted to doublets (R16)** — deeplinks stores
  `links(id, type_id, from_id, to_id)`. With doublets, the type moves into the
  source: `(v: T x)` is a value of `T` pointing at `x`, and a typed pair
  `from → to` becomes `(i: T p)` with `p = (from to)`. deep-foundation's
  `can` view and its `AllowSelect`/`AllowInsert` rules become the
  `AllowRead`/`AllowWrite` rules above. The mapping is detailed in
  [research/deep-foundation.md](research/deep-foundation.md#what-was-adapted-and-how-doublets-change-it).

**Evidence.**

- `packages/ui-links/tests/permissions.test.js`: "follows sub-types and
  multiple inheritance", "needs an Extends marker for more parents", "shows a
  subject only what it may read", "refuses writes, the storage unchanged",
  "keeps the hierarchy from who may write its values";
- `server.test.js`: "serves each subject what its permissions allow",
  "authenticates and pushes changes to subscribers", and the three tests of
  the links a subject creates;
- [`data/example-ui-links-permissions.txt`](data/example-ui-links-permissions.txt):
  two users; alice sees `Shared`, `memo` and `news`, and her update of the
  boss's note is refused.

## R15, R17, R20: the issues in link-cli

Planned as issues with blockers, as the comment asks, because their code
belongs to link-cli:

| Requirement                                      | Issue                                                                                                                                                                                                     |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R15 optional permission layer stored in links    | [link-cli#149](https://github.com/link-foundation/link-cli/issues/149), blocked by the type hierarchy [link-cli#148](https://github.com/link-foundation/link-cli/issues/148)                              |
| R17 triplets stored in doublets                  | [link-cli#151](https://github.com/link-foundation/link-cli/issues/151)                                                                                                                                    |
| R20 triplets over the text and binary API        | [link-cli#152](https://github.com/link-foundation/link-cli/issues/152), blocked by link-cli#151; client side [ui#117](https://github.com/link-foundation/ui/issues/117)                                   |
| R20 Hasura reimplementation of the Deep Standard | [link-cli#153](https://github.com/link-foundation/link-cli/issues/153), blocked by link-cli#149, link-cli#150 and link-cli#151; DeepClient API [ui#118](https://github.com/link-foundation/ui/issues/118) |

There is no written "Deep Standard": it is the GraphQL schema Hasura
generates for deeplinks (12 tables, 37 relationships, 2 computed fields, a
reserve action and the jwt/guest remote schemas;
[research/deep-foundation.md](research/deep-foundation.md#the-deep-standard)).
link-cli#153 states that schema as the contract.

The DeepClient portion is implemented in ui-links: local Hasura predicates,
all six relations, named applies and optimistic remapping over synced triplets.
Linked values work over both the LiNo and GraphQL transports. Permission checks
use the policy layer. The [Deepcase example](../../../examples/deepcase/README.md)
loads the published main graph and original React hooks against released clink;
its browser check verifies a live value update in the graph. The ported minilinks
cases and released-server tests are in `packages/ui-links/tests/deep*.test.js`.

## R18, R19, R22: the roadmap and the MVP

**MVP (R19, R22).** The doublets client and server are in this repository
and work on the native doublets protocol: link-cli's own client
(`@link-foundation/link-cli-client`'s `connectTcp`) talks to the ui-links
server ("works over TCP, with pushes to a synced client"), and the server
replays link-cli's protocol conversation
(`packages/ui-links/tests/fixtures/links-operations.txt`).

**Roadmap (R18).** Everything else is planned as 18 issues with "blocked by"
relations and sub-issues, across both repositories (see
[roadmap/README.md](roadmap/README.md)):

- in this repository, the tracking issue
  [ui#109](https://github.com/link-foundation/ui/issues/109) with
  ui#110–119, and the issue-101 section of
  [docs/ROADMAP.md](../../ROADMAP.md);
- in link-cli, the tracking issue
  [link-cli#147](https://github.com/link-foundation/link-cli/issues/147) with
  link-cli#148–153. link-cli has no roadmap file; its roadmap is that tracking
  issue, because this pull request cannot change link-cli.

`tests/issue-101-roadmap.test.js` checks that every planned issue exists,
that cross-repository references resolve, and that the section in
docs/ROADMAP.md is the generated one.

## R21: decorators and replaceable modules

Every layer has the storage interface and wraps another one: `observe`,
`withCascade`, `withPermissions`, `persistLinks`, the synced client (a
storage over a transport), and the server (any storage, any `authenticate`,
any policy). The transport is `{ send, onPush?, close? }`, so in-process and
TCP are interchangeable, and a WebSocket one (ui#110) adds without changes.
The query engine and the type system run the same on a client and a server.
This is the shape of link-cli's own decorators (`PinnedTypesDecorator`,
`NamedTypesDecorator`, `TransactionsDecorator`;
[research/link-cli.md](research/link-cli.md#decorators)).

## R23, R24: the case study and one pull request

This directory is the case study ([README.md](README.md)); everything,
including the issues, was done in pull request #108.

## Decisions

- **Hidden means missing.** A link the subject may not read answers like a
  deleted one, in `count`, `each`, queries and pushes. A forbidden write is
  `forbidden` and changes nothing.
- **Write needs the link before and after.** An update needs the right to
  write the link both as it is and as it will be, so a subject cannot move a
  link out of or into a type it may not write.
- **Rules cover the values of a type, not the type's own link.** The
  `Extends` pairs are of type `Extends`, so whoever may write the values of a
  type may not rewire the hierarchy (commit `c27de4a`).
- **Ownership of new links.** The server's create writes `(0 0)`, which no
  rule covers, so a link a subject created is its own while it is untyped;
  `forget(id)` drops the claim when the link is gone, so a later link at that
  address is not the subject's (commits `c95a502`, `5aaf3f3`).
- **A reference needs a right.** A subject may give its links a type it may
  not read only with a rule that covers it (`AllowReference`, or any rule
  naming the type); otherwise the address answers as a missing one. Decided in
  [ui#119](https://github.com/link-foundation/ui/issues/119), see
  [its case study](../issue-119/README.md).
- **Deviations from link-cli** are listed in the
  [package README](../../../packages/ui-links/README.md#compatibility-with-link-cli):
  the address `set-name` answers, address reuse, and the protocol
  extensions.

## A bug found and fixed on the way

A subject that may write notes could not create `(n: Note n)` through the
server: the reference check looked for `Note` through the subject's view,
where the type link itself is hidden, and the rollback of that failure went
through the view too, was refused, and left the update in the storage behind
a `Forbidden` error. The root cause was that the transaction used the
restricted view for bookkeeping. Commit `5aaf3f3` gives `transact` the
storage under the view for the reference check and the rollback; the tests
"lets a subject type the links it creates, as types it may not read" and
"undoes a failed request and reports its own error" failed before it.

## CI fixes

- **One changeset.** The changeset check allows exactly one changeset per
  pull request, so the three changesets became `.changeset/ui-links-package.md`
  (`ui-links: minor`, `ui-store: minor`, `ui-config: patch`).
- **CRLF on Windows.** On the Windows runners (Node.js, Deno and Bun), the
  checkout converted two kinds of input to CRLF.
  - The roadmap issue files are read by the front-matter parser of
    `experiments/issue-1/create-roadmap-issues.mjs`, which expects `---\n`.
    The roadmap test failed with "missing front matter".
  - `server.test.js` replays link-cli's protocol conversation line by line, and
    a blank line read as `"\r"` came before any request, giving "Cannot read
    properties of undefined (reading 'reply')".

  `.gitattributes` now keeps `docs/case-studies/issue-101/roadmap/**` and
  `packages/ui-links/tests/fixtures/**` in LF, as it already did for the other
  byte-exact inputs. `experiments/issue-101/crlf-checkout-probe.mjs`
  reproduces both errors with CRLF text. A clone with `core.autocrlf=true`
  gave CRLF files before the fix and LF files after it.

## Historical MVP limits (resolved by issue 109)

- **Pushes after rule changes**
  ([ui#113](https://github.com/link-foundation/ui/issues/113)). The server
  pushes the links a request changed, filtered per subscriber. When a rule or
  a type changes, links that become readable or hidden are not pushed; a
  client sees them on its next `load`.
- **Names are a sidecar**, not links, as in link-cli: the synced client does
  not receive names with the links it loads, and a name is checked only
  through the readability of the link it names
  ([ui#112](https://github.com/link-foundation/ui/issues/112)).
- **The outbox is in memory**: a reload loses unsent writes
  ([ui#114](https://github.com/link-foundation/ui/issues/114)).
- **Against `clink --serve` itself.** link-cli's client talks to the ui-links
  server, but the synced client needs `auth` and `subscribe`, which
  `clink --serve` does not have yet; running it against link-cli is
  [ui#116](https://github.com/link-foundation/ui/issues/116), blocked by
  link-cli#149 and link-cli#150.
