#!/usr/bin/env bash
# Bounded reproduction of the site-build timeout (#246). Pins the run to a few
# CPU cores and times the site build test standalone and inside the Deno shard
# that failed on Windows, for the matrix code before #228 (5cc0d7c^) and now.
# Usage: experiments/issue-246/contention-repro.sh [cores=0,1] [shard=1/3]
# Logs: ci-logs/issue-246-<variant>-<mode>.log (git-ignored).
set -uo pipefail
cores=${1:-0,1}
shard=${2:-1/3}
files=(packages/site/src/gallery/matrix.js packages/site/src/gallery/render.js)
restore() { git checkout -q HEAD -- "${files[@]}" deno.lock; }
trap restore EXIT
mkdir -p ci-logs
summary() {
  sed 's/\x1b\[[0-9;]*m//g' "$1" |
    grep -E '\[site-build\] (generate|bundle|render|write|child close|verify|abort)|Vite emits all.*\.\.\. |passed \||suite took' |
    sed -E 's/^.*(Vite emits all pre-rendered entries and deployable assets for \/ui\/ \.\.\. )/build test: /'
}
for variant in before after; do
  restore
  if [ "$variant" = before ]; then
    git show 5cc0d7c^:packages/site/src/gallery/matrix.js > "${files[0]}"
    git show 5cc0d7c^:packages/site/src/gallery/render.js > "${files[1]}"
  fi
  for mode in standalone shard; do
    log="ci-logs/issue-246-$variant-$mode.log"
    if [ "$mode" = standalone ]; then
      args=(packages/site/tests/build.test.js)
    else
      args=(--parallel --shard "$shard")
    fi
    start=$(date +%s)
    SITE_BUILD_TRACE=1 timeout 600 taskset -c "$cores" deno test -A "${args[@]}" > "$log" 2>&1
    status=$?
    echo "suite took $(( $(date +%s) - start ))s (exit $status)" >> "$log"
    echo "== $variant $mode (cores $cores)"
    summary "$log"
  done
done
