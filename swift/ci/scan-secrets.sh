#!/usr/bin/env bash
set -euo pipefail

image=zricethezav/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f
if git cat-file -e "$CI_BASE^{commit}" 2>/dev/null; then
  # Scan every new commit, including secrets removed by a later commit.
  args=(git --log-opts="$CI_BASE..HEAD" /repo)
else
  args=(git /repo)
fi
docker run --rm -v "$PWD:/repo:ro" -w /repo -e GIT_CONFIG_COUNT=1 -e GIT_CONFIG_KEY_0=safe.directory \
  -e GIT_CONFIG_VALUE_0=/repo "$image" "${args[@]}" --redact --no-banner
