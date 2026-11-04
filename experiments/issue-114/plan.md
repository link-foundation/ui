# Issue 114 work plan

No blockers, required sub-issues, issue comments, PR conversation comments,
inline comments or reviews at initial inventory. #109 tracks this work;
#101 supplies historical context, not additional required sub-issues.

1. Add regression tests for offline reload/replay, temporary references and
   remaps, cache refresh (updates, deletes, unreadable links), subscriptions
   after reconnect, refused writes, and all persistence adapters.
2. Add an async persistent opener using persistLinks and LiNo state on the
   same adapter. Preserve the synchronous factory and storage interface.
3. Replay writes before a full readable snapshot on reconnect; restore
   subscriptions. Choose snapshots because the server has no version log.
4. Document persistence API, conflict rule and delivery limits; add declarations
   and a minor changeset. Review the complete diff and merge main.
5. Run focused regressions and required npm test, lint, format:check and
   check:duplication sequentially with logs. Commit the verified batch, push
   only the prepared branch, collect all same-revision CI results, update
   PR #172 with criterion evidence, and mark ready only when CI passes.

Acceptance mapping: offline reload/replay -> persistent-client tests;
reconnect cache equals readable server -> reconnect snapshot tests;
cache/outbox/counter/remap persistence -> adapter matrix and remap reload;
server wins/refusal reporting -> persisted rollback test.

Draft verification: all 11 new regressions pass under Node.js, Bun and Deno.
The initial run failed all five original cases with missing openSyncedLinks.
Additional coverage checks concurrent writes and pushes during snapshots,
resuming acknowledged creates, persisted updates/deletes, and permission loss.
No rendered UI changed; browser screenshots are not applicable.
