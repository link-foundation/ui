# Expo React Native example

Run `npm ci` at the repository root first, then:

```sh
npm ci --prefix examples/react-native
cd examples/react-native
npx expo export --platform web --max-workers 1
npx serve dist
```

`npm start` launches Expo for a native development build or web preview. Expo
SDK 58 uses React Native 0.88 (New Architecture); versions were checked against
npm metadata and Expo's bundled native module versions. React Native Web runs
the same renderer. Metro loads the original issue-1 `document.lino` as text
through the small transformer; it does not duplicate the canonical sample.

Press OK (or focus it with Tab and press Enter) to dispatch `navigate home`,
update the greeting through the store, and announce the result. The example
respects the system color scheme and has no motion. The mapper's separate unit
tests cover images, unknown kinds and custom components beyond the sample.

New demo dependencies Expo, React Native and React Native Web are MIT licensed;
React and React DOM are MIT licensed too. No third-party asset is bundled.

Expo's Metro tooling also uses unmodified MPL-2.0 Lightning CSS platform binaries
only while building. They are not included in the web export or renderer. The
security workflow records this build-tool exception individually, following the
existing resvg and axe tooling exceptions; runtime dependencies remain permissive.

Run the browser checks with
`npx playwright test --config examples/react-native/playwright.config.mjs`
from the repository root after export. CI uses its pinned Playwright container.
