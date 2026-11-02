# link-cli: what the links server and the type system of this pull request follow

The comment of issue 101 names [link-cli](https://github.com/link-foundation/link-cli)
as the reference for substitution, the type system and the native doublets
protocol (R9, R14, R22), and asks for issues there (R15, R17, R18, R20). This
note records what link-cli has, read at commit `eb7074aa` (2026-10-24) of its
`main` branch, and how `packages/ui-links` relates to it. The open issues of
link-cli are kept in [`../data/link-cli-issues.json`](../data/link-cli-issues.json).

## The data model and the query language

- A link is a doublet `(index: source target)` (`docs/ARCHITECTURE.md`); the
  store is Data.Doublets (C#) or doublets-rs (Rust), a file-mapped
  `UnitedMemoryLinks`.
- A query is a restriction and a substitution in Links Notation: `() ((1 1))`
  creates, `((1 1)) ()` deletes, `((1: 1 1)) ((1: 1 2))` updates, and the same
  pattern on both sides reads. Variables (`$i`), `*`, names and nested links
  are allowed. The answer is one `(before) (after)` line per changed link.
- `ui-links`'s `runQuery` implements that language over any storage of the
  doublets-web interface (`packages/ui-links/src/query.js`), atomic, with the
  differences listed in the
  [package README](../../../../packages/ui-links/README.md#compatibility-with-link-cli).

## Decorators

link-cli builds its features as decorators over `ILinks`:

| Decorator                           | Does                                                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `PinnedTypesDecorator`              | the first six addresses are the types `(n: 1 n)`: `Type`, Unicode symbol/sequence, string, empty string, name |
| `NamedTypesDecorator`               | names in a sidecar `db.names.links`                                                                           |
| `PersistentTransformationDecorator` | stored triggers                                                                                               |
| `TransactionsDecorator`             | each create, update and delete recorded as a reversible transition in a sidecar store                         |
| `VersionControlDecorator`           | branches, tags and checkout over the transactions                                                             |
| `RemoteLinks`                       | a store whose links live behind `clink --serve`                                                               |

`PinnedTypes` checks that the link at address `n` is `(n: 1 n)`: a type is a
link whose source is the root type `1` and whose target is itself. That is
the rule `typeSystem` of ui-links extends to a hierarchy: a sub-type is
`(S: T S)` for any type `T`, not only the root, so `Type -> SubType ->
SubType -> Value` has any depth, and more parents are `(p: S T2)` pairs
marked `Extends` (R14). link-cli has no hierarchy yet:
[link-cli#148](https://github.com/link-foundation/link-cli/issues/148) asks
for it as a decorator of the same shape.

There is no permission decorator and no subscription in link-cli:
[link-cli#149](https://github.com/link-foundation/link-cli/issues/149)
(permissions stored in links, in the same file or a separate one) and
[link-cli#150](https://github.com/link-foundation/link-cli/issues/150)
(subscriptions over `--serve`) ask for them, with ui-links as the working
draft.

## The protocol of `clink --serve`

From the README section "Serve a database over TCP" and
`docs/protocol/links-operations.txt`:

- `clink --db db.links --serve host:port`; `--connect host:port 'query'` is a
  one-shot client.
- **Text**: UTF-8 Links Notation; each message ends with a line holding a
  single `.`, so `nc` can talk to it.
- **Binary**: `--protocol binary`, each packet is binary links notation
  (counted links, references 8, 16, 32 or 64 bits wide), with three optional
  decorators: `--external-references`, `--arity <RANGE>` (default `2`;
  `2..3` adds triplets, `1..` any length) and `--packed-widths`. The server
  detects the protocol of each message and replies in the same one.
- **Operations** (`LinksOperation`): `(count: (i s t))`, `(each: (i s t))`,
  `(create: (s t))`, `(update: (i s t))`, `(delete: i)`, `get-name`,
  `set-name`, `get-by-name`, `remove-name`, `()` for everything, and any other
  message is a substitution query. Errors are `(error: 'message')`.
- **Clients**: `RemoteLinks` in C# and Rust, and
  `@link-foundation/link-cli-client` (npm 0.1.0, Unlicense) for Node.js, Bun
  and Deno, with `connectTcp`.

`createLinksServer` of ui-links answers the same operations over any storage
and adds `(auth: token)`, `(subscribe: (i s t))` and `(unsubscribe: n)`; its
TCP framing is link-cli's, and the test suite replays link-cli's
`links-operations.txt` conversation
(`packages/ui-links/tests/fixtures/links-operations.txt`) and talks to the
server through `@link-foundation/link-cli-client`'s own `connectTcp`
([`../data/example-ui-links-tcp.txt`](../data/example-ui-links-tcp.txt)).

## Triplets

The binary protocol can already carry links of three references
(`--arity 2..3`), but the store, the query processor and every operation are
doublets only. The comment asks for triplets stored in doublets with a
similar associative API (R17) and served over the text and binary API (R20):
[link-cli#151](https://github.com/link-foundation/link-cli/issues/151) and
[link-cli#152](https://github.com/link-foundation/link-cli/issues/152). The
encoding proposed there, `(i: T p)` with `p = (from to)`, is discussed in
[deep-foundation.md](deep-foundation.md#what-was-adapted-and-how-doublets-change-it).

## Open link-cli issues this plan touches

| Issue                                                                  | Title                                                             | Relation                                                        |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------- |
| [link-cli#30](https://github.com/link-foundation/link-cli/issues/30)   | LiNo protocol server mode (LINO API)                              | `--serve` (from #105) implements most of it                     |
| [link-cli#34](https://github.com/link-foundation/link-cli/issues/34)   | LINO API (GraphQL)                                                | the Deep Standard GraphQL API of link-cli#153 is one form of it |
| [link-cli#138](https://github.com/link-foundation/link-cli/issues/138) | ACID readiness and transaction and concurrency control strategies | permissions and subscriptions must run inside one transaction   |
| [link-cli#140](https://github.com/link-foundation/link-cli/issues/140) | We need to double check we support all IPC possible               | a WebSocket transport (ui#110) is one more                      |

link-cli has no `docs/ROADMAP.md`. Its roadmap for this work is the tracking
issue [link-cli#147](https://github.com/link-foundation/link-cli/issues/147)
with the sub-issues link-cli#148–153; writing it into a file of link-cli
belongs to a pull request there, which this repository cannot make.
