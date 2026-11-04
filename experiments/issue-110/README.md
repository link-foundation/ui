# Issue 110 implementation and verification plan

Issue #110 has no blockers or required sub-issues. Issue #114 is related work,
not a dependency: this transport preserves the existing in-memory outbox.

1. Add a browser-native WebSocket transport and a Node server using MIT-licensed
   `ws`. Keep server imports out of the browser entry point. Test both frame
   types against identical operations, pushes and ordered concurrent requests.
2. Define one request/reply per WebSocket message, without TCP dot framing.
   Binary messages contain exactly one official links-notation packet. Propose
   this framing in link-foundation/link-cli#30, which has no framing decision.
3. Verify disconnects reject all waiting requests with `offline`, keep optimistic
   writes queued, and replay them on a new connection. Reject malformed binary
   packets and enforce the server message limit; clean up sessions on close.
4. Add a runnable WebSocket twin of the TCP example, executed by a repository
   test in the Node/Bun/Deno CI matrix. Add a Playwright page and two-tab test
   for text and binary, using the existing browser CI configuration.
5. Add public declarations, documentation and a minor changeset. Review the
   complete diff, run the four required gates on the pushed revision, inspect
   all same-revision CI failures, update PR #168 and mark it ready when green.

Evidence is recorded in the PR acceptance table. Local command logs go in the
ignored `logs/` directory; CI investigation logs go in `ci-logs/`.
