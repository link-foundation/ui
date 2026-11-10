#!/usr/bin/env bash
# Attribute build phases to the inlined theme registry: build the site once as
# is and once with `virtual:site-themes` reduced to the `base` theme, both
# pinned to two cores with SITE_BUILD_TRACE=1. Restores the plugin afterwards.
# Usage: experiments/issue-246/theme-module-cost.sh
set -euo pipefail
plugin=packages/site/vite-plugin-lino-pages.js
out=$(mktemp -d)
trap 'git checkout -- "$plugin"; rm -rf "$out"' EXIT
build() {
  echo "== $1"
  (cd packages/site && SITE_BUILD_TRACE=1 taskset -c 0,1 \
    node ../../node_modules/vite/bin/vite.js build --logLevel silent --outDir "$out" 2>&1 |
    grep -E '\[site-build\] [a-z ]+:')
  du -sh "$out"/assets/main-*.js | sed 's/\t.*\// /'
}
build 'all themes inlined'
sed -i 's/const data = JSON.stringify(themes,/const data = JSON.stringify(new Map([["base", themes.get("base")]]),/' "$plugin"
grep -q 'themes.get("base")' "$plugin"
build 'only base theme inlined'
