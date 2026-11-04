# Issue 74 implementation and verification

Dependencies #18 and #33 are closed; no required sub-issues or comments on
issue 74 or PR 167 as of 2026-11-04. Read all four PR comment endpoints.

- [x] Package, public API/declarations, LiNo specification and quiet sample.
- [x] Diagnostic theme reader: bundled themes, unknown keys and invalid input.
- [x] Audio graphs: oscillator/noise, envelopes, filters, FM, repeats, bus.
- [x] Player: gesture gate, off by default, modes, injected time/random,
      throttling, panning, volume/mute, cue subscription, reduced motion.
- [x] Bind actual DOM onAction and machine subscriptions using LiNo mapping.
- [x] Register sound comfort schema; bind settings to config user layer;
      presets/shared looks/randomize and reload persistence verified.
- [x] Port all 26 patches and provenance from immortality immutable revision
      16a6172c38fc120133485f805c49d980b9850bc4.
- [x] README, changeset and release metadata.
      Final revision checks, diff review, branch push and same-revision CI evidence
      are tracked in PR 167 alongside its ready-for-review status.

Use a fake recording BaseAudioContext for deterministic graph assertions, as
explicitly allowed by the issue. This package has no visual UI changes.

Evidence before final commit: 17 package tests passed; full npm suite had
3741 passed, 2 existing skips, 0 failures before the last three focused cases
were added. Lint, format, duplication and asset policy passed. Real Chromium
OfflineAudioContext probe rendered 31 voices with nonzero finite output and
exact silence after the envelope. Final commit verification and CI are recorded
in PR 167.
