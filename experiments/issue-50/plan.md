# Issue 50 work plan

- [x] Read issue, all comments, PR conversation/inline/reviews, repository guidance.
- [x] Dependencies #47 and #12 are closed; no required sub-issues are listed.
- [x] Add rem type scale, semantic colours and contrast pairs, shapes, density, motion and materials as LiNo.
- [x] Load fragmented themes and density-only iOS/macOS inheritance.
- [x] Style and template the existing #34 controls, including segmented radio groups and a stepper using number-field and button parts.
- [x] Add the shared mapping loader, SwiftUI rows and generated documentation.
- [x] Verify all pairs in combined modes, density allow-list, no restricted assets, opaque material fallbacks and reduced-motion fading.
- [x] Browser gallery: six screenshots, axe, 200% font scaling, all native hit targets, keyboard behaviour and comfort overrides.
- [x] Review full diff, changesets, merge latest main, commit atomic implementation; run four required gates on exact commit, push only prepared branch.
- [ ] Collect every same-revision CI result and preserve all failed logs before a corrective push; update PR evidence and mark ready only when green.

The #12 digest names semantic concepts but does not include the numeric HIG tables promised by #50. Record primary HIG URLs and explicit theme choices in docs/themes/hig.md. #48 merged during validation. Merge its Material 3 API and documentation generator, preserving both theme families and mapping APIs.

Browser evidence: all five focused checks pass in installed Chrome; the root configuration exercises Chromium and WebKit in CI. Six review images are in docs/screenshots/hig/. All four repository gates passed on cf336b8. Its Windows CI exposed CRLF conversion of the generated HIG guide; add its LF checkout rule, matching Material 3. Simulating core.autocrlf=true reproduces 120 CRLF lines before and zero after the rule. Final CI status is recorded in PR #159.
