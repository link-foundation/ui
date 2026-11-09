# Issue 222 work plan

No Dependencies section, required sub-issues, issue comments, or PR feedback
were present at the initial read. Related issues are context, not blockers.
No consumer site code will be copied.

1. Regression tests, then live graph controls: ramped volume/tone/send,
   persistent dry/wet routing, room replacement, silent envelope origin,
   cached noise and random offsets.
2. Player: runtime mapping, no-repeat random selection, global modes,
   headroom/event levels, humanization, stereo, preview, sticky activation,
   visibility suspension, configurable reduced-motion events.
3. Generate nested LiNo settings: ordered slots, character labels, comfort
   preservation, global controls and conditional visibility; config wiring.
4. Capture document binding: full element/input/pointer matrix, disabled
   controls, details deduplication, custom cue channel, disposal.
5. Public declarations, specification, consumer wiring example, changeset.
6. Focused fake-audio/DOM/settings tests, required four quality gates,
   whole-diff review, commit/push, current-SHA CI audit, PR evidence and ready.

Verification maps directly to the eleven issue acceptance criteria through
live.test.js, document.test.js and settings.test.js, plus graph/player tests.
Full required commands run sequentially with output retained in /tmp.

## Requirement evidence

All source is original framework code against the behavior specification.
There are no required sub-issues or upstream blockers.

| Issue acceptance criterion                                | Automated evidence                                                                   |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Existing bus nodes/context update live; room swaps buffer | live.test.js: changes existing bus nodes; unlocks on sticky activation               |
| Initially dry bus becomes wet                             | live.test.js: changes existing bus nodes smoothly                                    |
| 1000 random plays do not repeat; singleton remains stable | live.test.js: never repeats either of two random voices                              |
| Zero spread exact; 15-cent bounds                         | live.test.js: applies exact deterministic gain; bounds spread 15                     |
| Stereo off retains part pan; width scales pointer         | live.test.js: applies exact deterministic gain                                       |
| Level 2 doubles peak; empty mapping silent                | live.test.js: applies exact deterministic gain; never repeats                        |
| Progressive slots and preserved comfort keys              | settings.test.js: generates ordered conditional slots; preserves every generated key |
| Hidden suspend; next visible play resumes                 | live.test.js: unlocks on sticky activation                                           |
| Sticky activation first play; inactive creates no context | live.test.js: unlocks on sticky activation; enables and plays in same first click    |
| Document element matrix, hover, details and overrides     | document.test.js: all four integration tests                                         |
| Noise reuses a single buffer                              | live.test.js: reuses a noise buffer                                                  |

Additional prose requirements are covered by runtime modes/throttle and
sub-15-cent variation tests; settings config integration (consumer events,
boost, live tone, global mode and silent slots); preview/mute tests;
configurable motion suppression; muted visual-cue throttling; and real OfflineAudioContext verification
of fractional-sample repeated envelopes. Browser tests exercise the standard
settings panel, named voice labels, progressive slots, preview controls,
conditional room/width and an axe WCAG audit.

Focused verification: 36 sound tests pass and two real-browser tests pass.
The checked-in screenshot shows the demo's progressive voice slots and preview.
The changeset prepares ui-sound minor and ui-components patch releases.
