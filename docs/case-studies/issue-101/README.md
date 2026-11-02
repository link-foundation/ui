# Case study: issue 101 — associative storages, a synced client and a server with permissions

[Issue #101](https://github.com/link-foundation/ui/issues/101) asked for a
`setPositional` operation in ui-store. A comment on it widened the scope:

- ui-store should use doublets-web and other storages (IndexedDB,
  `localStorage`, Links Notation, SQLite in the browser) behind one
  associative interface with link-cli's substitution;
- a minilinks-like client should keep part of the data locally, write at once
  and stay in sync with a server, receiving only what its user may access;
- an example server should have permissions as in deep-foundation, on doublets,
  with link-cli's type system extended to a recursive hierarchy with
  multiple inheritance;
- link-cli should get issues for a permission layer stored in links, triplets
  in doublets, triplets over its text and binary API, and a Hasura
  reimplementation of the Deep Standard;
- the roadmaps of both repositories should be updated;
- everything should be planned and executed in one pull request, with this
  case study.

The doublets MVP is pull request
[#108](https://github.com/link-foundation/ui/pull/108): the `setPositional`
operation, the package `@link-foundation/ui-links`, and ui-store documents in
any links storage. Everything beyond it is 18 issues in this repository and
in link-cli.

## Contents

| Path                                                         | What it holds                                                                                                                                |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| [`requirements.md`](requirements.md)                         | Every requirement, R1–R6 from the issue and R7–R24 from the comment, quoted or paraphrased, with its status.                                 |
| [`solutions.md`](solutions.md)                               | For every requirement: the solution, the alternatives, the evidence (tests, examples, commits, issues), the decisions and the known limits.  |
| [`research/library-survey.md`](research/library-survey.md)   | Existing libraries for storages, synced clients and permission filtering, with licences, and what this pull request reuses.                  |
| [`research/deep-foundation.md`](research/deep-foundation.md) | The associative architecture of deep-foundation (the article, deeplinks, minilinks, the "Deep Standard") and how it was adapted to doublets. |
| [`research/link-cli.md`](research/link-cli.md)               | link-cli's data model, decorators, `clink --serve` protocol and open issues, and how ui-links relates to them.                               |
| [`roadmap/`](roadmap/README.md)                              | The sources of the 18 created issues, the footers, the created numbers and how to run the script.                                            |
| [`data/`](data/)                                             | Raw data: the issue as JSON, link-cli's issues, the outputs of the examples, the test runs on Node.js, Deno and Bun, and the script's runs.  |
| [`../../ROADMAP.md`](../../ROADMAP.md)                       | The roadmap of this repository; its last section lists the issue-101 issues.                                                                 |

Code:

- [`packages/ui-links`](../../../packages/ui-links/README.md): storages,
  substitution queries, types, permissions, the links server and the synced
  client;
- `packages/ui-store`: the `setPositional` operation and
  `writeDocumentLinks`/`readDocumentLinks`;
- `packages/ui-config`: `bindStore` uses `setPositional`.

Examples, with their outputs in `data/`:

- [`examples/ui-links-permissions.mjs`](../../../examples/ui-links-permissions.mjs):
  types, permissions, two users;
- [`examples/ui-links-tcp.mjs`](../../../examples/ui-links-tcp.mjs): the server
  on TCP, link-cli's client, a synced client with pushes;
- [`examples/ui-store-links.mjs`](../../../examples/ui-store-links.mjs): a UI
  document in SQLite links.

Experiments are in [`experiments/issue-101/`](../../../experiments/issue-101/):

- `create-issues.mjs` creates and updates the roadmap issues;
- `fresh-note-probe.mjs` and `fresh-note-server-probe.mjs` reproduced the bug
  fixed in commit `5aaf3f3` (a subject could not type the links it created);
- `readme-snippet.mjs` runs the example of the ui-links README.
