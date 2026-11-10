---
'@link-foundation/ui-links': patch
---

Make each synced write cost its own size rather than the cache's: settle
compares only the addresses a write can change, the checkpoint is not built
without a `saveState`, name deliveries decode the names once through
`LinksNames.namesOf`, and long in-process flushes yield to timers so a test
timeout can fire.
