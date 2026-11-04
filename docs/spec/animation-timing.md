# Animation timing

This contract reconciles the animation engine (#52) and designer timeline
(#57), as required by #186. It supersedes #52's original step-6 example that
placed animation easing in WAAPI `options.easing`.

## Key offsets and easing

A key offset MUST denote a literal fraction of one iteration's duration.
Delay, iteration count, direction and fill determine the directed iteration
progress `p` using the Web Animations timing model. Animation easing MUST NOT
change `p` before selecting the surrounding keys.

For adjacent keys at offsets `a` and `b`, the interpolation progress MUST be
`(p - a) / (b - a)`. The easing on the key at `a` MUST apply to this local
progress. If that key has no explicit easing, the animation easing MUST be
used; if neither declares easing, interpolation MUST be linear. An explicit
`linear` key easing overrides a nonlinear animation easing. Easings MUST NOT
be composed by applying both the animation and key easing.

The first and last values hold outside the declared keys. A single key
holds its value. Step and spring easings keep their defined endpoint and
overshoot behavior within each segment. Envelopes weight the resulting
values using directed iteration progress. Procedural effects have no key
segments and MUST continue receiving animation-eased iteration progress.
Reduced-motion variants use the same timing rules after substitution.

## Sampler, player and editor agreement

The pure sampler and browser player MUST use this same contract. The WAAPI
compiler MUST set effect timing `easing` to `linear` and put each segment's
resolved easing on its starting keyframe. Envelope animations continue to
use sampled keyframes with linear timing. The designer MUST seek the player
without rewriting animation easing or key offsets.

For the unchanged sample below, resolving `motion.duration.short` to 1000 ms
MUST give scale `0.96` at a 500 ms seek in both sampler and player:

```lino
press-feedback: animation
  target ok
  duration
    token motion.duration.short
  easing standard
  track scale
    key 0 1
    key 0.5 0.96
    key 1 1
```

With the sample theme's 150 ms duration, the same key is reached at 75 ms.
This changes the former global-easing behavior (approximately `0.990227`
at the midpoint) and its WAAPI output; animation source remains compatible.
The regression fixtures are the original issue-1 sample and the unchanged
`packages/ui-designer/tests/fixtures/animation.lino`. Sampler, compiler and
player unit tests and the designer's browser midpoint test enforce this
agreement.
