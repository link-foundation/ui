# Issue 46 implementation and verification

Dependency #34 is closed; #14 is closed. No issue comments, required sub-issues,
PR conversation comments, inline comments or reviews at initial inspection.

1. [x] Parser-backed validation: all samples; exact unclosed-input diagnostic;
       lexical colouring only; parser-derived link folds and bracket pairs.
2. [x] Lazy default CodeMirror engine, optional Monaco peer; JavaScript, CSS,
       JSON and Markdown packages; documented permissive licences.
3. [x] Pure documents model: document-id drafts, 500ms injected-clock debounce,
       persisted editor-tabs, dirty close confirmation, empty saves, conflict choices.
4. [x] Exported code-editor element and LiNo kind: labelled editor, APG tabs,
       inline and live diagnostics, conflict bar, side-by-side comparison; no execution.
5. [x] Two sample tabs example; automated browser regression coverage for all
       acceptance criteria, accessibility, screenshots (tabs, error, conflict).
6. [ ] Changeset, public API/docs, whole diff review, four required checks on
       pushed revision, latest main merged, all same-revision CI results inspected,
       PR title/body/evidence updated and ready only after green CI. Never merge.

Verification uses focused node tests first, Chromium/WebKit browser tests, then
sequential required gates with logs outside the repository and CI's full matrix.

Evidence before final CI:

- `node --test packages/ui-components/tests/editor/*.test.js` plus the public
  entry-point collision tests: 23 passing;
  language tests pin all seven samples, EOF 3:1 and the full parser message.
- `npx playwright test packages/ui-components/tests/e2e/editor.spec.js`:
  18 passing in Chromium/WebKit, including both engines, all four additional
  languages, draft restoration, conflict choices, empty saves, dirty close,
  APG tabs, Escape/Tab, source-only rendering, inline diagnostics and axe audits.
- Six reviewed screenshot baselines cover tabs, unclosed input and conflicts.
- Current main (62f872f) merged; settings-panel exports and entry-point checks
  retained. Final four gates and same-revision hosted CI remain pending.

CI investigation for 2b2ff87:

- Preserve all non-passing workflow logs after completion; check run timestamps
  and head SHA, then collect every failure before pushing another revision.
- Security audit job 126086197383, log lines 187–199: Monaco 0.57.0 pins
  vulnerable DOMPurify 3.4.15. Its sanitizer is also bundled, so an override would only silence the audit.
  Use the pinned 0.58.0-dev-20261103 build, which includes 3.4.17, and
  regenerate both runtime locks; upstream report microsoft/monaco-editor#5517.
- Swift core job 126086198132, log lines 288 and 1351: the embedded vocabulary
  must match the updated shared spec byte for byte. Refresh that data copy.
