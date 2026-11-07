# Issue 209 release verification

- [x] Read issue, all comments, PR conversation/reviews and repository rules.
      No required sub-issues or blocking dependencies; #66 is related migration work.
- [x] Queue every public runtime workspace for an initial minor release through
      Changesets; verify generated versions and sibling ranges without manual bumps.
- [x] Pack every runtime workspace with its real lifecycle scripts; assert public
      exports, generated icons/worker and their notices, README and LICENSE exist.
- [x] Install actual archives outside the checkout with production dependencies
      only; build and run a Vite/React application without aliases or source patches.
- [x] Verify settings, React rendering, generated icons, asynchronous network
      worker and foreign inspector in a browser; retain screenshot evidence.
- [ ] Required local checks on the pushed revision; review full diff, push only
      the prepared branch, collect every CI failure before any follow-up push.
- [ ] Update PR #218 evidence/checklist and mark ready after green CI.
- [ ] Actual npm publication and verification from registry archives.

## External blocker

Main run 42313474630 (2026-11-06, SHA 44fb93c) fails Release Preflight:
all 19 runtime packages are absent from npm and cannot use OIDC until the first
publication. Log lines 152–170 identify the missing packages and required
`NPM_TOKEN` bootstrap secret. The repository secrets API returns no secrets.
A maintainer must supply a granular publish token, authorize release, then
configure release.yml as trusted publisher for every package. Keep publication
unchecked until registry installation and browser verification succeed.

An unrelated inherited lint warning in ui-links/src/server.js:464 also makes
main's lint job fail (log lines 3637–3642). PR lint filters unchanged warnings. Tracked separately in [#219](https://github.com/link-foundation/ui/issues/219).
