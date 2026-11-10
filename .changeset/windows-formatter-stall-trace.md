---
'@link-foundation/ui-core': patch
---

Keep the Windows Deno release formatter fixture from writing Node's compile cache and npm log files during its nested `npx prettier` run, and trace event-loop stalls in it, without changing release packages.
