#!/usr/bin/env bash
set -euo pipefail

lock="$SWIFT_PACKAGE/Package.resolved"
if ! git ls-files --error-unmatch "$lock" >/dev/null 2>&1; then
  echo "::notice::There is no committed SwiftPM lockfile in this package. The build requires one if dependencies resolve."
  exit 0
fi

image=ghcr.io/google/osv-scanner:v2.7.1@sha256:a70ffffc2bfd33482953e5d6b64c6fcdb30239717a07b0f0d3ab2859ce3e4cde
# Fail on every reported advisory. OSV keeps the advisory database current
# independently of this commit, so also run this audit on a schedule.
docker run --rm -v "$PWD:/repo:ro" -w /repo "$image" scan source --lockfile "$lock"
