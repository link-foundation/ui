---
'@link-foundation/ui-components': minor
---

Add `@link-foundation/ui-components` with diagrams written in Links Notation: a `diagram` dialect (`kind`, `direction`, `node`, `edge`, `group`) that round-trips through LiNo, a deterministic Dagre layout with layout plugins (`(layout NAME)`), an accessible SVG renderer, `toMermaid` export, and the `<ui-diagram>` and `<ui-mermaid-view>` elements. The Mermaid adapter imports Mermaid (an optional peer) only when a Mermaid diagram is shown, and it falls back to the source text with an error if Mermaid cannot load.
