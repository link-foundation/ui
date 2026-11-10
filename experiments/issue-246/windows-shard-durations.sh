#!/usr/bin/env bash
# Print the site build test duration of the Windows Deno shard 1/3 for each run
# (all attempts). Usage: windows-shard-durations.sh RUN_ID...
set -uo pipefail
repo=link-foundation/ui
mkdir -p ci-logs
for run in "$@"; do
  for attempt in 1 2 3; do
    job=$(gh api "repos/$repo/actions/runs/$run/attempts/$attempt/jobs?per_page=100" \
      --jq '.jobs[] | select(.name == "Test runtimes (windows-2025, deno, 1/3)") | .id' 2>/dev/null) || break
    [ -n "$job" ] || break
    log="ci-logs/job-$job.log"
    [ -s "$log" ] || gh run view --repo "$repo" --job "$job" --log > "$log" 2>/dev/null
    result=$(sed -E 's/(\x1b|\^\[)\[[0-9;]*m//g' "$log" |
      grep -oE 'Vite emits all pre-rendered entries and deployable assets for /ui/ \.\.\. (ok|FAILED) \([^)]*\)' |
      sed -E 's/.*\.\.\. //')
    child=$(grep -oE '\[site-build\] child close(: | \(at )[0-9]+ms' "$log" | grep -oE '[0-9]+ms')
    echo "$run attempt $attempt job $job: ${result:-no build test} ${child:+child close $child}"
  done
done
