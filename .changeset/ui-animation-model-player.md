---
'@link-foundation/ui-animation': minor
---

Add `@link-foundation/ui-animation`: animations written in Links Notation (`animation` links with keyframe tracks, cubic-bezier, steps and spring easings, procedural effects such as the seeded `decipher`, additive layers with bell and sustain envelopes, `(reduced-motion ...)` variants and `(on STATE ...)` triggers; `timeline` links with `at`, `sequence`, `parallel` and `stagger`), a pure seeded sampler, safety validation (persistent fills on clip-path and transforms, WCAG 2.3.1 flashes, missing reduced motion), a WAAPI compiler with springs as CSS `linear()`, and a player with an injectable clock that follows `data-motion` and `prefers-reduced-motion` and plays the triggers of a ui-store document. GSAP is never used.
