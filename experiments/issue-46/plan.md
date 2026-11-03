# Issue 46 implementation and verification

Dependency #34 is closed; #14 is closed. No issue comments, required sub-issues,
PR conversation comments, inline comments or reviews at initial inspection.

1. [ ] Parser-backed validation: all samples; exact unclosed-input diagnostic;
       lexical colouring only; parser-derived link folds and bracket pairs.
2. [ ] Lazy default CodeMirror engine, optional Monaco peer; JavaScript, CSS,
       JSON and Markdown packages; documented permissive licences.
3. [ ] Pure documents model: document-id drafts, 500ms injected-clock debounce,
       persisted editor-tabs, dirty close confirmation, empty saves, conflict choices.
4. [ ] Exported code-editor element and LiNo kind: labelled editor, APG tabs,
       inline and live diagnostics, conflict bar, side-by-side comparison; no execution.
5. [ ] Two sample tabs example; automated browser regression coverage for all
       acceptance criteria, accessibility, screenshots (tabs, error, conflict).
6. [ ] Changeset, public API/docs, whole diff review, four required checks on
       pushed revision, latest main merged, all same-revision CI results inspected,
       PR title/body/evidence updated and ready only after green CI. Never merge.

Verification uses focused node tests first, Chromium/WebKit browser tests, then
sequential required gates with logs outside the repository and CI's full matrix.
