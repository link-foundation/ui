---
'@link-foundation/ui-links': patch
---

Rebase pending doublets edits on server replies, pushes and loads, retaining confirmed state across refusals and reloads. Reject writes depending on refused creates without leaving phantom temporary links. Verify reference permissions against released clink in the shared contract and example.

Reuse existing permission rule pairs and marks so repeated grants are idempotent and exported grants survive clink's doublets uniqueness resolution.
