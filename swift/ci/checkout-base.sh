#!/usr/bin/env bash
set -euo pipefail

if [[ "$GITHUB_EVENT_NAME" == pull_request ]]; then
  if ! git cat-file -e "$CI_BASE^{commit}" 2>/dev/null; then
    git -c credential.helper= -c "credential.helper=!gh auth git-credential" fetch --no-tags origin "$CI_BASE"
  fi
  git -c user.name='Swift CI' -c user.email='swift-ci@users.noreply.github.com' merge --no-edit "$CI_BASE"
fi
