#!/usr/bin/env bash
# Shrink the site build budget to force cancellation, then check that every
# runtime terminates and reaps the Vite child (no orphaned `vite.js build`).
# Usage: experiments/issue-246/cancel-check.sh [budget-ms]
set -uo pipefail
budget=${1:-3000}
copy=packages/site/tests/cancel-probe.test.js
trap 'rm -f "$copy"; git checkout -q deno.lock 2>/dev/null' EXIT
sed "s/const BUILD_BUDGET = 50_000;/const BUILD_BUDGET = $budget;/" \
  packages/site/tests/build.test.js > "$copy"
for runner in "node --test" "deno test -A" "bun test --timeout 60000"; do
  echo "== $runner"
  read -ra command <<< "$runner"
  SITE_BUILD_TRACE=1 timeout 120 "${command[@]}" "./$copy" 2>&1 |
    sed 's/\x1b\[[0-9;]*m//g' |
    grep -E 'site-build\] (child|abort|vite)|terminated|^ℹ (pass|fail)|passed|\(pass\)|\(fail\)'
  sleep 2
  if pgrep -f '[v]ite/bin/vite.js build' > /dev/null; then
    echo "ORPHAN: $(pgrep -af '[v]ite/bin/vite.js build')"
    pkill -f '[v]ite/bin/vite.js build'
  else
    echo "no orphaned build"
  fi
done
