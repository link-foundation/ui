# Associative links completion audit

[Issue #109](https://github.com/link-foundation/ui/issues/109) tracks the
accepted work after the [issue-101 MVP](../issue-101/README.md). This audit
includes the issue bodies, all sub-issue comments, the
[final scope clarification](https://github.com/link-foundation/ui/issues/109#issuecomment-6665801480),
and all three kinds of feedback on [PR #206](https://github.com/link-foundation/ui/pull/206).
The audit found no PR conversation comments, inline comments or reviews.

## Scope and dependencies

All ten sub-issues are closed. Nine are completed; browser SQLite/OPFS
[#111](https://github.com/link-foundation/ui/issues/111) was closed as not
planned with an
[explicit rejection](https://github.com/link-foundation/ui/issues/111#issuecomment-6587419600).
It is excluded by the parent's scope clarification. Native SQLite and the
browser IndexedDB, localStorage and LiNo adapters remain supported.

The upstream tracking issue
[link-cli#147](https://github.com/link-foundation/link-cli/issues/147) and
its dependencies #148–153 are completed. The reference-permission decision
was reported upstream as
[link-cli#161](https://github.com/link-foundation/link-cli/issues/161), now
completed too. The integration target is the released Rust clink 2.1.1.
No new dependency defect was found during this audit.

## Requirement and verification inventory

Paths below are relative to the repository root. Package tests run in the
Node.js, Bun and Deno CI matrix. Released-clink tests require `CLINK`; they
visibly skip without it, and run with it in the `clink-client` CI job.

| Issue                                                    | Accepted requirements                                                                                                                                                                                     | Implementation and automated evidence                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#113](https://github.com/link-foundation/ui/issues/113) | Push newly readable links and deletions after grants, revocations and type changes; invalidate only affected subjects.                                                                                    | `server-policy.js`; `packages/ui-links/tests/server-policy.test.js` checks Alice's grant/revoke cache, rule and subject updates, primary and multiple inheritance, atomic delivery and cached subject scans. Existing client/server tests still run.                                                                                                                                                                                                  |
| [#119](https://github.com/link-foundation/ui/issues/119) | Compare reference policies, prevent existence leaks without rights, retain typing and explicitly granted references, report the decision upstream.                                                        | [Decision and alternatives](../issue-119/README.md); `references.test.js` covers hidden/missing addresses and names, atomic writes, implied rights and grants without reading. `clink.test.js` and `examples/ui-links-permissions.mjs` now check the same rule on both servers. Upstream #161 is completed.                                                                                                                                           |
| [#110](https://github.com/link-foundation/ui/issues/110) | Browser WebSocket transport, official text/binary encoding, one message per request, ordered replies, offline rejection with retained outbox, server and runnable example, two-tab browser test.          | `websocket.js`, `websocket-server.js`; `websocket.test.js` checks framing, ordering and disconnects; `examples/ui-links-websocket.mjs` runs in CI; `tests/ui/links-websocket.e2e.mjs` synchronizes two tabs in text and binary modes. The framing proposal is recorded in link-cli#30.                                                                                                                                                                |
| [#112](https://github.com/link-foundation/ui/issues/112) | Store names as doublets through the common interface; load and sync them with data; protect both named links and encoding metadata.                                                                       | `links-names.js` and server/client integration; `links-names.test.js` checks Unicode persistence, atomic queries and renames, subscribed rename/reassignment/removal, hidden data and metadata, and overlapping subscriptions.                                                                                                                                                                                                                        |
| [#114](https://github.com/link-foundation/ui/issues/114) | Persist cache, queue, rollback records, temp IDs, remaps and subscriptions through the same adapters; replay then refresh the readable snapshot; server wins.                                             | `client-state.js`, `client-cache.js` and `client.js`; `client-persistence.test.js` checks all three browser/text adapters, offline reload, remap resumption, deletion and permission reconciliation, and snapshot races. New `client-concurrency.test.js` checks overlapping accepted/refused writes, pushes, loads, remote deletion, refused-create dependencies and rebased rollback after reload.                                                  |
| [#115](https://github.com/link-foundation/ui/issues/115) | Bind live ui-store documents in both directions with minimal writes, links origin and local undo; converge concurrent edits and roll back refusals; browser example.                                      | `packages/ui-store/src/doublets/bind-links.js`; `packages/ui-store/tests/bind-links.test.js` covers all operations, two-store convergence, rollback, offline reconnect and a one-handle scalar edit. `tests/ui/store-links.e2e.mjs` edits two browser stores and checks local undo.                                                                                                                                                                   |
| [#116](https://github.com/link-foundation/ui/issues/116) | Run the same client contract against reference and released clink, permissions in data or separate files, executable example, accurate deviations.                                                        | `clink.test.js`, `examples/lib/ui-links-clink.mjs`, and the permissions example; the `clink-client` CI job runs all on Node.js, Bun and Deno. The package README now removes the obsolete reference-permission deviation.                                                                                                                                                                                                                             |
| [#117](https://github.com/link-foundation/ui/issues/117) | Shared triplet encoding, three-part substitution, synced triplets, official protocol conversation over text/binary, released-clink CRUD.                                                                  | `triplets.js`, `triplets-query.js`, `triplets-client.js`; `triplets.test.js`, `triplets-server.test.js`, `triplets-client.test.js` and `clink.test.js` cover shared encoding, fixture replay, query rollback, remaps, subscriptions and real-server CRUD.                                                                                                                                                                                             |
| [#118](https://github.com/link-foundation/ui/issues/118) | Minilinks/DeepClient API, Hasura predicates and all six relations locally and on server, linked values and permission checks, optimistic remaps, ported cases and the actual Deepcase main view on clink. | `deep*.js`; `deep.test.js` ports minilinks cases and verifies named applies and remaps. `deep-clink.test.js` exercises real GraphQL queries, persisted strings/numbers/objects, permission grants and streaming subscriptions. The [Deepcase example](../../../examples/deepcase/README.md) builds the published main graph and original React hooks; its browser check verifies live values, deletion, keyboard use and accessibility against clink. |
| #109 completion                                          | All accepted sub-issues closed and the issue-101 roadmap marked done.                                                                                                                                     | This inventory records completion and the explicit #111 rejection. `docs/ROADMAP.md` and its generator mark the section done; `tests/issue-101-roadmap.test.js` checks that regeneration preserves it.                                                                                                                                                                                                                                                |

## Defect found and fixed

[Bug #207](https://github.com/link-foundation/ui/issues/207) exposed stale
rollback records in the doublets client. Unlike the triplets client, it
applied remote changes directly over optimistic edits, ignored successful
update replies and undid refused writes using the values saved when queued.
Two overlapping refusals could restore another refused value; pushes or loads
could erase pending edits; a refusal after a remote deletion could resurrect
a link. Writes depending on a refused create could leave phantom temp IDs.

The fix keeps server observations beneath the pending queue, learns accepted
replies, replays remaining edits and rebases their inverse records. It
persists those records and refused-create dependencies through the existing
LiNo checkpoint, with backward-compatible loading. Acknowledged self-creates
still retain their real address before their update resumes.

Seven of the eight new concurrency regressions failed before the fix. All
pass afterward; the eighth preserves overlapping-subscription behavior.
Reproduce with:

```sh
node --test packages/ui-links/tests/client-concurrency.test.js
```

`onChange` reports local, remote, remap and rollback changes; `onError` reports
refusals and transport failures. These existing opt-in hooks provide tracing
without logging by default. The regression transport holds individual sends
to reproduce races deterministically without timers or stress workloads.

## Verification commands and limits

```sh
npm test -- --test-concurrency=1
npm run lint
npm run format:check
npm run check:duplication
node examples/ui-links-permissions.mjs
CLINK=clink node --test packages/ui-links/tests/clink.test.js packages/ui-links/tests/deep-clink.test.js
node examples/ui-links-permissions.mjs --server clink
```

The PR's CI runs supply the released-server and browser evidence for its
exact commit. CI builds clink with one Cargo job; local validation avoids
rebuilding Rust within the development container's memory limit. The final
run URLs and check results are recorded in [PR #206](https://github.com/link-foundation/ui/pull/206).

The existing durability boundary remains adapter `flush()`. Delivery is at
least once if a connection is lost after a server commit but before its
reply; the protocol has no request deduplication. These documented limits do
not omit an accepted criterion. The Deepcase integration uses its published
main graph and hooks as requested; its example README describes the boundary
with the full upstream application.
