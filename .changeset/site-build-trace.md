---
'@link-foundation/ui-core': patch
---

Add opt-in site build phase timings (`SITE_BUILD_TRACE=1`) and make the site
build test terminate and reap its Vite build at a finite deadline in every
test runtime, including Bun, whose runner does not abort `t.signal`.
