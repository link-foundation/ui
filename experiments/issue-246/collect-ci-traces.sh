#!/usr/bin/env bash
# Collect site-build traces and build-test durations from Deno CI jobs.
# Usage: experiments/issue-246/collect-ci-traces.sh RUN_ID... > traces.txt
# Full logs are kept in ci-logs/ (git-ignored) for later review.
set -euo pipefail
repo=link-foundation/ui
mkdir -p ci-logs
for run in "$@"; do
  gh run view "$run" --repo "$repo" --json jobs \
    --jq '.jobs[] | select(.name | test("Test runtimes")) | "\(.databaseId)\t\(.conclusion)\t\(.name)"' |
    while IFS=$'\t' read -r job conclusion name; do
      log="ci-logs/job-$job.log"
      [ -s "$log" ] || gh run view --repo "$repo" --job "$job" --log > "$log" 2>&1 || true
      sed -E 's/(\x1b|\^\[)\[[0-9;]*m//g' "$log" |
        grep -E '\[site-build\]|Vite emits all pre-rendered entries.*(ok|FAILED|# )|suite finished in' |
        sed -E 's/^.*Z (.*)$/\1/' |
        sed "s|^|$run $job [$conclusion] $name: |" || true
    done
done
