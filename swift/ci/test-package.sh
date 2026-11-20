#!/usr/bin/env bash
set -euo pipefail
cd "$SWIFT_PACKAGE"
swift --version
options=(-j "${SWIFT_BUILD_JOBS:-2}")
if [[ -f Package.resolved ]]; then
  options+=(--disable-automatic-resolution)
fi

swift package dump-package >/dev/null
swift build --build-tests "${options[@]}" -Xswiftc -warnings-as-errors
if [[ -f Package.resolved ]] && ! git ls-files --error-unmatch Package.resolved >/dev/null 2>&1; then
  echo "::error::Commit Package.resolved so CI can audit and reproduce the full dependency tree."
  exit 1
fi
swift test --skip-build "${options[@]}"
