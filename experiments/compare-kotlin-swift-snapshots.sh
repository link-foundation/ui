#!/usr/bin/env bash
# Compares the ui-kotlin render-tree snapshots with the ui-swift ones (#30,
# PR #105) after the primitive renames listed in packages/ui-kotlin/README.md.
# Usage: experiments/compare-kotlin-swift-snapshots.sh [swift-git-ref]
# Prints every line that still differs; exits 1 when any does.
set -euo pipefail
ref="${1:-pr105}"
kotlin=packages/ui-kotlin/src/commonTest/resources/snapshots
swift=packages/ui-swift/Tests/Snapshots
status=0
swift_files=$(git ls-tree -r --name-only "$ref" -- "$swift" | grep '\.render\.lino$' | sed "s|^$swift/||" | sort)
kotlin_files=$(cd "$kotlin" && find . -name '*.render.lino' | sed 's|^\./||' | sort)
if [ "$swift_files" != "$kotlin_files" ]; then
  echo "The snapshot sets differ:"; diff <(echo "$swift_files") <(echo "$kotlin_files") || true; status=1
fi
for f in $swift_files; do
  expected=$(git show "$ref:$swift/$f" | sed -E \
    -e 's/ ScrollView/ Column (scroll vertical)/; s/^ScrollView/Column (scroll vertical)/' \
    -e 's/([ (])VStack/\1Column/; s/([ (])HStack/\1Row/; s/([ (])AsyncImage/\1Image/' \
    -e 's/([ (])EmptyView/\1Box/' \
    -e 's/\(alignment center\)/(alignment CenterHorizontally)/; s/\(alignment leading\)/(alignment Start)/; s/\(alignment trailing\)/(alignment End)/' \
    -e 's/\(alignment top\)/(alignment Top)/; s/\(alignment bottom\)/(alignment Bottom)/')
  if ! out=$(diff <(echo "$expected") "$kotlin/$f"); then
    echo "== $f"; echo "$out"; status=1
  fi
done
exit $status
