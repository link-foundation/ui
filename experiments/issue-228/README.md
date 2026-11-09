# Issue 228 probes

`solver-protocol.worker.mjs` is the real module-worker transport fixture used
by the solver-job tests. Its echo backend tests execution only; it is not a
collision solver.

`renderer-crossings.mjs` reproduces the compatibility question in
[issue 249](https://github.com/link-foundation/ui/issues/249), exposed after
merging the renderer from issue 227. Run:

```bash
node experiments/issue-228/renderer-crossings.mjs
```

It applies turns `[-90, 90]` to both links of `22 11` through the renderer's
canonical per-link options. This mapping is an explicit assumption because
issue 228 abbreviates its input. The actual visible curves cross twice,
near box coordinates `(33.5407, 50)` and `(66.4593, 50)`. The probe uses 256
segments per visible cubic and checks proper segment intersections, independently
of any proposed scorer. It writes the provider SVG and an HTML preview under
`/tmp/issue-228-renderer` (or an optional output directory argument).

The browser evidence is committed at
[`docs/screenshots/issue-228-clean-input-crossings.png`](../../docs/screenshots/issue-228-clean-input-crossings.png).
This is a reproduction, not an automated regression test claiming a fix.
The fixture/renderer mismatch must be reconciled before the clean-input
acceptance criterion can be verified. No solver implementation is stubbed.
