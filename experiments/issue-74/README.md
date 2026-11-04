# Issue 74 verification

The implementation checklist is [plan.md](plan.md).

## Reproduce the theme port

The upstream revision is `16a6172c38fc120133485f805c49d980b9850bc4`,
Unlicense. Download both files from that revision and run:

```bash
gh api repos/konard/immortality/contents/app/src/sound.ts?ref=16a6172c38fc120133485f805c49d980b9850bc4 --jq .content | base64 -d > /tmp/issue74-sound.ts
gh api repos/konard/immortality/contents/app/src/settings.ts?ref=16a6172c38fc120133485f805c49d980b9850bc4 --jq .content | base64 -d > /tmp/issue74-settings.ts
node experiments/issue-74/port.mjs /tmp/issue74-sound.ts /tmp/issue74-settings.ts
```

The script evaluates the trusted upstream data declarations after removing
TypeScript types with the existing esbuild dependency, and formats the
result with ui-core `formatLinks`. There are no downloaded recordings.

## Real browser audio probe

```bash
node experiments/issue-74/browser-audio.mjs
```

Open `http://127.0.0.1:8744` in Playwright MCP, then evaluate
`async () => (await import('/probe.js')).probe()`.
The finite probe renders each of 31 voices sequentially, three seconds
at 44.1 kHz, in a real OfflineAudioContext. Expected result:
`{ rendered: 31, allAudible: true, allSilentAfterEnvelope: true }`.
It checks nonzero finite samples and exact silence after the scheduled
voice end. Close the browser and stop the server with Ctrl+C afterward.

The probe passed in Chromium on 2026-11-04. Automated fake-context graph
checks remain in the package suite and run on every supported test runtime.

## Resource bounds

Run the full required test command as `npm test -- --test-concurrency=2`
to cap worker processes in the 2.92 GiB container. Other required commands
are `npm run lint`, `npm run format:check`, `npm run check:duplication`.
No frontend, styles or visual controls are changed by this package.
