# Issue 249 probes

These probes reconcile the clean `22 11` input of issue 228 with the default
doublet renderer. The complete input is the shared fixture
[`doublet-22-11-clean.lino`](../../packages/ui-components/tests/links-view/fixtures/doublet-22-11-clean.lino).

- `painted-check.mjs [options-file]` prints the painted report (visible
  centreline crossings between links, own-half crossings outside the joint
  radius, and the smallest painted gap in box units) for the fixture, for no
  turns and for turns on both links.
- `angle-scan.mjs [step]` scans fixed baseline end angles with link 1 turned
  `-90 90`.
- `render.mjs [out-dir] [label]` writes the provider SVG of the fixture and an
  HTML preview with its painted report (default `/tmp/issue-249-renderer`).

The behaviour reference (the consumer site, which has no license, so no code is
copied) reports the fixture clean, with a painted distance of about 1.01 box
units at its stroke width of 1.3. The reference draws link 2 of `22 11` with
the same middle direction as link 1. It turns fixed end angles toward the
mirror side, and it moves gapped reference ends along their end tangent. The
renderer from issue 227 differed in all three points. The fixture therefore
crossed itself or painted link 1's end arrow over link 2 near link 2's middle.
After the corrections, `painted-check.mjs` prints for the fixture:

```text
fixture {"crossings":[],"ownCrossings":[],"gap":1.7551909782121298}
```

The regression test is
`packages/ui-components/tests/links-view/doublet-clean-input.test.js`.
