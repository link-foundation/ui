---
'@link-foundation/ui-animation': minor
---

Make key offsets literal iteration time positions. Animation easing now defaults
per segment, with explicit key easing overriding it, in both the pure sampler and
WAAPI player. This changes previous global-easing interpolation and compiled
WAAPI output while preserving animation source and the timeline midpoint.
