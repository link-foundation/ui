# Issue 234 work plan

Requirements and verification:

- Brand adapter: optional Simple Icons package, CC0 records and trademark
  notice, brand title for `label=true`, missing/withdrawn marks diagnosed
  and drawn as placeholders. Verify adapter, registry and DOM tests.
- Static subsets: nested LiNo manifest selects exactly the named icons;
  preserve the full default build. Validate unknown names before writing,
  emit module, sprite, records, attribution and licenses. Verify 20-icon
  build and static source tests.
- Presentation: current-color fill, stroke widths 0.5–3, size length/token,
  diagnose and ignore invalid values, support DOM attributes and LiNo.
  Verify DOM tests and real-browser colors in light/dark themes.
- Inline messages: use the explicitly allowed parts-helper alternative,
  preserving unknown placeholders and localizing accessible icon labels.
  Keep ui-i18n independent of ui-components. Verify both locales in unit
  and real-browser accessibility tests.
- Release: changesets for both packages; document APIs and a runnable example.
- Review full diff, merge latest main if needed, commit, run npm test, lint,
  format:check and check:duplication on the candidate; push only the prepared
  branch, collect same-revision CI results, update PR 252 and mark ready.

No required sub-issues or explicit blockers are listed in #234. #66 is open
but is context only; the requested existing APIs are available. No consumer
site source is used. The subset manifest is an explicit selection rather
than an addition to all 32 defaults, to satisfy the exactly-20 criterion;
source `names` mappings remain additive for compatibility.
