#!/usr/bin/env bash
# All check jobs materialize the same commit computed by the detection job.
set -euo pipefail

if [[ "$GITHUB_EVENT_NAME" == pull_request ]]; then
  # Fetch once, then pass the immutable base SHA to every other job.
  git -c credential.helper= -c "credential.helper=!gh auth git-credential" fetch --no-tags origin "refs/heads/$BASE_REF"
  base=$(git rev-parse FETCH_HEAD)
elif [[ "$GITHUB_EVENT_NAME" == merge_group ]]; then
  base=$MERGE_BASE
else
  base=$BEFORE_SHA
fi

if [[ "${FULL_VALIDATION:-false}" == true || "$GITHUB_EVENT_NAME" == workflow_dispatch || -z "$base" || "$base" =~ ^0+$ ]]; then
  base=$(git hash-object -t tree /dev/null)
elif ! git cat-file -e "$base^{commit}" 2>/dev/null; then
  # A force push can make the previous SHA unreachable. Check the whole tree.
  echo "::notice::Previous commit unavailable. Checking the full tree." >&2
  base=$(git hash-object -t tree /dev/null)
fi

if [[ "$GITHUB_EVENT_NAME" == pull_request ]]; then
  # The preview already contains the PR head. Refresh it when main moved
  # after the event, without pushing or executing with a write credential.
  git -c user.name='Swift CI' -c user.email='swift-ci@users.noreply.github.com' merge --no-edit "$base" >&2
fi

printf 'base=%s\n' "$base" >> "$GITHUB_OUTPUT"
