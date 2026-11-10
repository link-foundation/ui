# Issue 228 probes

`solver-protocol.worker.mjs` is the real module-worker transport fixture used
by the solver-job tests. Its echo backend tests execution only; it is not a
collision solver.

`renderer-crossings.mjs` checks the clean input of issue 228 against the
default renderer. [Issue 249](https://github.com/link-foundation/ui/issues/249)
reconciled that input as the shared fixture
[`doublet-22-11-clean.lino`](../../packages/ui-components/tests/links-view/fixtures/doublet-22-11-clean.lino):
turns `-90 90` belong to link 1 only, link 2 is unturned, and the ends keep the
default fixed 30-degree angles. Run:

```bash
node experiments/issue-228/renderer-crossings.mjs
```

The probe samples 256 segments per visible cubic and checks proper segment
intersections with its own code, independently of any solver. It also prints
the painted report of the test helper `doublet-painted.js` (stroke, markers,
miter tips and dots, with no middle exemption). The fixture has no
intersections and a smallest painted gap of about 1.76 box units, above the
default clearance of 1. For comparison it also prints the earlier assumption
that applied the turns to both links: that drawing still folds link 2 over
itself and paints link 1 over link 2, so it is not clean. Before the renderer
corrections of issue 249, that mapping crossed twice near `(33.5407, 50)` and
`(66.4593, 50)`; see
[`docs/screenshots/issue-228-clean-input-crossings.png`](../../docs/screenshots/issue-228-clean-input-crossings.png).
The probe writes the provider SVG and an HTML preview under
`/tmp/issue-228-renderer` (or an optional output directory argument).
