# deep-foundation: the associative architecture to adapt

The comment on issue 101 asks to adapt "the associative architecture of
deep-foundation" and of the article
[habr 656879](https://habr.com/ru/companies/deepfoundation/articles/656879),
"but instead of triplets, we need to support doublets". This page records
what that architecture is, from the primary sources, checked on 2026-11-02.
Nothing was cloned or run; files were read on GitHub at deeplinks commit
`381207dd` (default branch `main`, last push 2024-10-26). **B** below is
`https://github.com/deep-foundation/deeplinks/blob/381207dda313ab3c1fed0a4bfc2ddbe631750411`.

## The article

«Стартап с другой планеты» ("A startup from another planet"), Deep.Foundation
company blog, 2022-03-22, by `leon_3` (Ivan Glazunov). It announces Deep.Case
/ Deep 0.1.0-alpha.0. Its claims, translated:

| Section                             | Claim                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Обзор (Overview)                    | "An associative data-oriented operating space": it stores data, reacts to semantic events, runs code in isolated containers, and "provides a GraphQL API to associative memory with a context-dependent rights system".                                                                                                                    |
| Дата-ориентированно (Data-oriented) | "The only access API is CRUD operations on links." The code is in the public domain.                                                                                                                                                                                                                                                       |
| Связи (Links)                       | "A link is a stored unit of meaning." Every link has a type, which is a link too (possibly itself). A type without `from`/`to` makes instances without them; a type whose `from`/`to` point at types makes instances that must point at links of those types. Values (number, string, object) are allowed by a `Value` link from the type. |
| Деревья (Trees)                     | Materialized paths in any direction; a link can be in several trees with several parents; no need to design the model around indexes.                                                                                                                                                                                                      |
| Селекторы (Selectors)               | "Like a stored query": a `bool_exp` plus "inside this subtree".                                                                                                                                                                                                                                                                            |
| Правила (Rules)                     | "Action that a Subject can do with an Object", each part a selector.                                                                                                                                                                                                                                                                       |
| Обработчики (Handlers)              | Every action is link CRUD on behalf of a JWT-authenticated link; handlers are link structures that pick an execution standard.                                                                                                                                                                                                             |
| Архитектура (Architecture)          | "Deep is not a specific storage implementation… Deep is intended as a standard for working with associativity." PostgreSQL plus Hasura "as the GraphQL adapter and provider of an implementation of the bool_exp standard".                                                                                                                |

## deeplinks, the implementation

**Links.** `links(id, type_id, from_id, to_id)`: a triplet with an identity
(`B/migrations/1616701513782-links.ts#L21`), indexes on each column, Hasura
relationships `from`, `to`, `type`, `in`, `out`, `typed`, and a computed
`value` field. Values live in `strings`, `numbers` and `objects`
(`(id, link_id, value)`, `B/migrations/1622421760250-values.ts`) and are
deleted with their link.

**Selectors and rules.** Triggers keep a `selectors_cache` from links of the
core types `SelectorTree`, `SelectorInclude`, `SelectorExclude` and
`SelectorFilter` (`1616701513790-selectors-cache.ts`); the `selectors` view
joins it with the materialized paths (`1622421760258-selectors.ts`; its
`SelectorExclude` part is commented out at this commit). The `can` view
`(rule_id, subject_id, object_id, action_id)` flattens rules
(`1622421760259-can.ts`).

**Permissions** (`1622421760260-permissions.ts`, `imports/permission.ts`).
Hasura row permissions for the role `link`, with the subject from the JWT
claim `x-hasura-user-id`:

| Operation | Checked on                   | Action        |
| --------- | ---------------------------- | ------------- |
| select    | the link (`can_object`)      | `AllowSelect` |
| insert    | the **type** of the new link | `AllowInsert` |
| update    | the link                     | `AllowUpdate` |
| delete    | the link                     | `AllowDelete` |

Anonymous users get the same rules with the subject `Any`; administrators are
those with `AllowAdmin`. Triggers add what Hasura cannot express: `from`/`to`
must conform to the type ("Type conflict"), a link has both or neither of
`from` and `to`.

**minilinks** (`B/imports/minilinks.tsx#L311`). `MinilinkCollection` is an
in-memory store indexed by id, from, to and type, with link objects that
expose `type`, `from`, `to`, `in`, `out`, `typed`. `select(query)` evaluates
Hasura's `where` locally (`B/imports/minilinks-query.ts#L222`);
`apply(data, name)` diffs a whole result set per named "apply", counting
references so a link stays while any apply holds it, and maps optimistic
(negative) ids to real ones.

**DeepClient** (`B/imports/client.tsx#L895`). `select`, `subscribe`, `insert`,
`update`, `delete`, `serial` (batched mutations), `reserve`, `id(package,
name)`, `can`, `jwt`/`guest`/`login`, on Apollo: HTTP to `/v1/graphql` and
subscriptions over `apollo-link-ws` (the legacy `subscriptions-transport-ws`
protocol). With `apply`, results go into minilinks.

**Licences.** deeplinks, deepcase, deep-foundation/hasura and
deep-foundation/deep are Unlicense.

## The "Deep Standard"

There is no written specification and no published schema: no "Deep
Standard" document or `schema.graphql` in the organisation, and the Notion
"GraphQL" page points at the playground of a running instance. The standard
is, in practice, the schema Hasura generates from deeplinks' migrations:

- tables and views `links`, `strings`, `numbers`, `objects`, `mp` (`tree`),
  `selectors`, `can`, `handlers`, with 37 relationships and 2 computed
  fields;
- Hasura's `where`, `order_by`, `limit`, `offset`, `_aggregate`, nested
  inserts, `_set` updates, several mutations per request;
- an event trigger on `links`, a `reserve` action, `jwt`/`guest`/`packager`
  remote schemas, JWT mode with an unauthorised role.

So "a Hasura reimplementation of the Deep Standard" means reproducing that
generated schema (recorded by introspection) for the operations `DeepClient`
sends. This is link-foundation/link-cli#153.

## What was adapted, and how doublets change it

| deep-foundation                                | here (doublets, `packages/ui-links`)                                                                    |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| link `(id, type, from, to)`                    | doublet `(id: source target)`; the **source is the type**: `(v: T x)` is a value of `T` pointing at `x` |
| a type is a link, possibly its own type        | the root is the point `(Type: Type Type)`; a sub-type is `(S: T S)`                                     |
| several parents via trees                      | extra parents `(p: S T2)` marked `(m: Extends p)`; `isA`/`ancestorsOf` follow both, cycles included     |
| rule = selectors of subject, object, action    | rule = pair `(g: Subject Object)` marked `AllowRead` or `AllowWrite`; `Anything` matches all            |
| select/update/delete checked on the link       | read and write checked on the link (write implies read)                                                 |
| insert checked on the type of the new link     | write checked on the link after the change; a fresh untyped link is its creator's until typed           |
| Hasura filters rows per subject                | `withPermissions` hides unreadable links; the server answers each session as its subject                |
| subscriptions through Hasura live queries      | `(subscribe: (i s t))` and pushed `(notify: n)` changes, filtered per subscriber                        |
| minilinks `apply` with optimistic negative ids | `createSyncedLinks`: a cache, an outbox, temporary addresses counted down from `MAX_ADDRESS`, remap     |
| GraphQL over PostgreSQL                        | link-cli's LiNo protocol (text and binary) over any doublets storage                                    |

Triplets come back as a layer over doublets (link-foundation/link-cli#151),
which the type-as-source encoding makes direct: a triplet `(i: T f t)` is the
doublet `(i: T p)` with the pair `p = (f t)`.

## Sources

- https://habr.com/ru/companies/deepfoundation/articles/656879/
- https://github.com/deep-foundation/deeplinks (commit `381207dd`):
  `migrations/1616701513782-links.ts`, `1616701513790-selectors-cache.ts`,
  `1622421760250-values.ts`, `1622421760258-selectors.ts`,
  `1622421760259-can.ts`, `1622421760260-permissions.ts`,
  `1658622099992-unvalue.ts`; `imports/minilinks.tsx`,
  `imports/minilinks-query.ts`, `imports/client.tsx`,
  `imports/permission.ts`, `imports/jwt.ts`; `index.ts`;
  `docker-compose.yml`.
- https://github.com/deep-foundation/hasura/blob/main/client.tsx
- https://github.com/deep-foundation/deepcase
- https://ivansglazunov.notion.site/GraphQL-12a676a2508541cf9a63cfeb564ffe7d,
  https://ivansglazunov.notion.site/Rules-841005d9110e4d8b9402761d963f936c

Not verified: whether the `can` view treats `SelectorExclude` rows as grants
(read from SQL only), and which WebSocket protocol current deepcase uses in
practice (inferred from its `apollo-link-ws` dependency).
