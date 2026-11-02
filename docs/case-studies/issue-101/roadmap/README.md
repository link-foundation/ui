# Issue 101 — roadmap issues

The comment of issue 101 asks for the doublets MVP here and for "all other
issues" to be "created here and in link-cli", with blockers (R18, R19, R22).
The issues were created from the files in [`issues/`](issues/), one per
issue, in two repositories, with GitHub's "blocked by" relations and
sub-issues, including across the repositories.

## The issues

| Key | Issue                                                                  | Type    | Title                                                                                                         | Blocked by    |
| --- | ---------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------- | ------------- |
| T01 | [ui#109](https://github.com/link-foundation/ui/issues/109)             | Task    | Roadmap: associative links beyond the doublets MVP (transports, storages, sync, triplets, Deep)               | —             |
| T02 | [link-cli#147](https://github.com/link-foundation/link-cli/issues/147) | Task    | Roadmap: associative architecture in doublets and triplets (permissions, types, subscriptions, Deep Standard) | —             |
| U01 | [ui#110](https://github.com/link-foundation/ui/issues/110)             | Feature | ui-links: WebSocket transport for browsers, text and binary                                                   | —             |
| U02 | [ui#111](https://github.com/link-foundation/ui/issues/111)             | Feature | ui-links: SQLite storage in the browser (sqlite-wasm on OPFS)                                                 | —             |
| U03 | [ui#112](https://github.com/link-foundation/ui/issues/112)             | Feature | ui-links: names stored as links, synced and permission-checked like links                                     | —             |
| U04 | [ui#113](https://github.com/link-foundation/ui/issues/113)             | Bug     | ui-links server: push the links that become readable or hidden when rules or types change                     | —             |
| U05 | [ui#114](https://github.com/link-foundation/ui/issues/114)             | Feature | ui-links synced client: persist the outbox and resynchronise after a reconnect                                | —             |
| U06 | [ui#115](https://github.com/link-foundation/ui/issues/115)             | Feature | ui-store: a live document over a synced links client                                                          | U05           |
| U07 | [ui#116](https://github.com/link-foundation/ui/issues/116)             | Task    | ui-links: run the synced client against clink --serve with permissions and subscriptions                      | L02, L03      |
| U08 | [ui#117](https://github.com/link-foundation/ui/issues/117)             | Feature | ui-links: triplets client over the links protocol                                                             | L04, L05      |
| U09 | [ui#118](https://github.com/link-foundation/ui/issues/118)             | Feature | ui-links: a DeepClient and minilinks compatible API over the synced client                                    | U08, L06      |
| U10 | [ui#119](https://github.com/link-foundation/ui/issues/119)             | Feature | ui-links permissions: decide whether referencing an unreadable link needs its own rule                        | —             |
| L01 | [link-cli#148](https://github.com/link-foundation/link-cli/issues/148) | Feature | Type hierarchy decorator: Type -> SubType -> … -> Value with multiple inheritance                             | —             |
| L02 | [link-cli#149](https://github.com/link-foundation/link-cli/issues/149) | Feature | Optional permission layer with permissions stored in links                                                    | L01           |
| L03 | [link-cli#150](https://github.com/link-foundation/link-cli/issues/150) | Feature | Subscriptions in the LiNo protocol server: subscribe, notify, unsubscribe                                     | —             |
| L04 | [link-cli#151](https://github.com/link-foundation/link-cli/issues/151) | Feature | Triplets stored in doublets with an associative API                                                           | —             |
| L05 | [link-cli#152](https://github.com/link-foundation/link-cli/issues/152) | Feature | Serve triplets over the Links Notation text and binary protocol                                               | L04           |
| L06 | [link-cli#153](https://github.com/link-foundation/link-cli/issues/153) | Feature | Hasura-compatible GraphQL server implementing the Deep Standard, so deepcase connects to link-cli             | L02, L03, L04 |

U01–U10 are sub-issues of T01 and L01–L06 of T02. The same tables, grouped by
repository, are the issue-101 section of [docs/ROADMAP.md](../../../ROADMAP.md).
The numbers, IDs and URLs are in [`created-issues.json`](created-issues.json).

## The files

Each file in `issues/` has the front matter of
`experiments/issue-1/create-roadmap-issues.mjs` (`key`, `title`, `type`,
`labels`, `blocked_by`, `requirements`) plus:

- `repo`: `ui` or `link-cli`, the repository the issue is created in;
- `parent`: the tracking issue it is a sub-issue of, or `null`.

In a body, `{{U04}}` becomes `#113` in the same repository and
`link-foundation/ui#113` in the other. Every issue gets a generated
"Dependencies" section with its blockers, its tracking issue and its
requirements, and the issues under a tracking issue get the footer of their
repository ([`issue-footer-ui.md`](issue-footer-ui.md),
[`issue-footer-link-cli.md`](issue-footer-link-cli.md)).

## Running the script

```bash
node experiments/issue-101/create-issues.mjs --dry-run   # check and list
node experiments/issue-101/create-issues.mjs             # create or update
```

It is idempotent: it creates the issues that are missing, rewrites the
bodies of all of them, adds the relations that are missing, and rewrites the
issue-101 section of `docs/ROADMAP.md` (everything after the marker
`<!-- roadmap section of issue 101 -->`, which the issue-1 script keeps). A
relation GitHub refuses is logged as "could not record" and stays visible in
the generated "Dependencies" section. The outputs of the three runs are in
[`../data/roadmap-dry-run.txt`](../data/roadmap-dry-run.txt),
[`../data/roadmap-create.txt`](../data/roadmap-create.txt) and
[`../data/roadmap-update.txt`](../data/roadmap-update.txt).

`tests/issue-101-roadmap.test.js` checks the files, that every issue was
created, that references across the repositories resolve, and that the
section in `docs/ROADMAP.md` is the one the script generates.
