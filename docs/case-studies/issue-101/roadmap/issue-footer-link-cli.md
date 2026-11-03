## Context of this issue

This issue was planned in
[link-foundation/ui#101](https://github.com/link-foundation/ui/issues/101)
(pull request [link-foundation/ui#108](https://github.com/link-foundation/ui/pull/108)),
which asks for a client and a server of the associative architecture of
[deep-foundation](https://github.com/deep-foundation) on doublets first and on
triplets later, with link-cli as the server. The requirements, the research
and the decisions are in the
[issue 101 case study](https://github.com/link-foundation/ui/tree/main/docs/case-studies/issue-101).

A JavaScript reference of the doublets part is
[`@link-foundation/ui-links`](https://github.com/link-foundation/ui/tree/main/packages/ui-links):
it serves the `LinksOperation` protocol of `clink --serve` (it replays
`docs/protocol/links-operations.txt`) over any storage, and its tests are the
behaviour this issue should match in C# and Rust. Where this issue and
ui-links differ, the issue decides, and ui-links follows.

- Follow this repository's `docs/ARCHITECTURE.md` and its contributing
  rules: every layer is a decorator over `ILinks` with the same interface, in
  C# and Rust, with the same tests in both.
- Wire formats are Links Notation (text and binary), as in
  `docs/protocol/`.
- Done means: every acceptance criterion is checked, CI is green, and the
  pull request says `Fixes #<this issue>`.
