# Issue 227: default doublet provider

Objective: implement and verify every requirement of [issue 227](https://github.com/link-foundation/ui/issues/227) in [PR 242](https://github.com/link-foundation/ui/pull/242). The issue has no Dependencies section, required sub-issues or comments; PR 242 initially has no conversation, inline comments or reviews. The existing provider bridge from merged PR 217 is the integration point. No consumer source, assets or tests are copied.

## Work plan and requirement inventory

1. Define the public LiNo options, validation and deterministic placements: 1-based pairs, free/self ends, all layout transforms, dice/cards, circle permutation, auto selection and pinned frames.
2. Implement two-cubic geometry with own-middle anchors, continuous tangent, bisectors, bulge, fixed/mirror angles, tension, turns, overlap lenses and symmetric loops.
3. Implement arc-length gaps/cuts, nine parametric markers, joins, tip compensation and marker-aware fitting.
4. Implement shared SVG preview/export: line styles, glow, backgrounds, cards/borders, six captions, dimensions, accessibility and raster parity through the existing encoder.
5. Export availability helper, provider and types; document options and original runnable gallery; add changeset.
6. Review whole diff, run focused numerical/browser tests and four required quality gates on final revision, merge latest main into branch, push, collect all same-revision CI failures before any corrective push, update PR evidence and mark ready only after green CI.

## Verification map

| Requirement                                         | Verification evidence                           |
| --------------------------------------------------- | ----------------------------------------------- |
| Input, bounds and option validation                 | Node rejection/boundary tests                   |
| Three links, two cubic segments, tangent and anchor | Numerical geometry and SVG path tests           |
| Point-symmetric figure-eight within 1e-6            | Sampled cubic rotation comparison               |
| Lone 0.9 and network 0.42 free lengths              | Layout-coordinate distance assertions           |
| Local turns of exactly 30/-30 degrees               | Independent derivative angle comparison         |
| Four inheritable gaps and half omission             | Arc length before/after in layout and box units |
| Nine shapes at both sizes, offsets/across/rotation  | Node shape tests and browser gallery            |
| Painted arrow tips within 0.01 for all joins        | Numeric compensation and browser pixel checks   |
| Fit margins/cap and pinned frame                    | Exact transform assertions and invalid frames   |
| Circle permutation and dice/cards/layout transforms | Placement tests                                 |
| Captions for 1, 9, 12 links                         | Browser bounding boxes and textLength           |
| Every background/card in SVG and raster             | Real browser PNG decoding and pixel comparison  |
| Accessible identical preview and export             | Browser DOM/axe and SVG equality                |
| Inert option helper                                 | Network feature matrix tests                    |

## Implementation and verification

The additional styles are opt-in through `createDoubletProvider`; existing
link/network renderers retain their API and behavior. The strict option reader,
placements, cubic/arc tools, markers and SVG rendering have separate modules.
The existing presentation bridge supplies transactional updates and raster
encoding. Public declarations, a minor changeset and an original browser gallery
ship with the provider. Debug callbacks are optional and silent by default.

- `node --test packages/ui-components/tests/links-view/doublet.test.js`: 15
  numerical/validation tests cover the table above, including the 1e-6 loop and
  0.01 painted-tip tolerances. The initial test failed because the provider did
  not exist. Review added regressions for mirror lenses and unit dice spacing.
- `npm run test:ui -- packages/ui-components/tests/e2e/doublet.spec.js --workers=1`:
  five scenarios in both Chromium and WebKit cover accessibility, reviewed
  screenshots, all caption modes/fonts/counts, all 20 background/border
  combinations, raster encoders, painted arrow tips and exact preview/export
  markup equality. Baselines live beside the browser tests.
- The four repository gates run on the final committed revision before push;
  same-revision CI is checked before marking PR 242 ready. CI run links and
  final totals are recorded in the pull request.

## Explicit interpretation of unspecified details

Caption spellings, dice tiling, zero spread, option defaults without specified
ranges and the LiNo field vocabulary are defined in
[the provider specification](../../spec/doublet-provider.md). Cards retain the
requested ±0.7 columns; dice pips have unit nearest-neighbour spacing. Aspect,
spread and rotation apply after the base placements. The `columns` control
applies to grid/hex rows and dice tiles; fixed two-column cards retain their
specified placement. A pinned frame intentionally bypasses automatic fitting.

Compensated markers move along the local endpoint tangent, which preserves tip
position even on curved links. Join-specific painted extensions use actual
miter/round/bevel stroke geometry; the curve is trimmed by that extension plus
its cap. Explicit offset/across/rotation disables compensation even when zero.

The bounded [pixel probe](../../../experiments/issue-227/README.md) explains
WebKit's translucent PNG round-trip quantization and the two-level premultiplied
RGB tolerance in the browser test. Alpha and visible card/background output are
also checked independently. All implementation and gallery content are original;
no unlicensed consumer code or assets are incorporated.
