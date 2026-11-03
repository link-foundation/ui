#!/usr/bin/env bash
# Run the icon gallery Playwright spec in the pinned CI container (the
# same image as .github/workflows/ui-tests.yml), with the host checkout and
# its node_modules. Extra arguments go to `playwright test`, for example
# --update-snapshots to write the visual baselines.
set -euo pipefail
cd "$(dirname "$0")/../.."
IMAGE='mcr.microsoft.com/playwright@sha256:b0ab6f3cb99aa7803adbc14d9027ec1785fc6e433b97e134e0f8fe61683b6b53'
node scripts/build-icons.mjs
docker run --rm --ipc=host --user "$(id -u):$(id -g)" \
  -e HOME=/tmp -e CI=1 -e PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
  -v "$PWD":/work -w /work "$IMAGE" \
  npx playwright test packages/ui-components/tests/e2e/icons.spec.js "$@"
