// Print the build-icons errors for the failure fixtures of build.test.js.
import { buildIcons } from '../../scripts/build-icons.mjs';
import {
  SVG,
  inFixture,
} from '../../packages/ui-components/tests/icons/helpers.js';

await inFixture(
  { extra: { 'assets/icons/own/fixture-unrecorded.svg': SVG } },
  async (root) =>
    console.log((await buildIcons({ root, sets: ['own'] })).errors)
);
await inFixture(
  {
    extra: { 'assets/icons/remix/fixture-remix.svg': SVG },
    records: `(fixture-remix: asset\n  (kind icon)\n  (files assets/icons/remix/fixture-remix.svg)\n  (license LicenseRef-RemixIcon)\n  (copyright 'Remix Design')\n  (attribution none))\n`,
  },
  async (root) =>
    console.log((await buildIcons({ root, sets: ['own', 'remix'] })).errors)
);
