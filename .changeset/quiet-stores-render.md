---
'@link-foundation/ui-store': patch
'@link-foundation/ui-dom': patch
---

Keep optional doublets-web WASM out of DOM renderer and foreign inspector builds
by using the memory store entry. Export GENERATED_ID_PREFIX from that entry while
preserving the root WASM adapter APIs.
