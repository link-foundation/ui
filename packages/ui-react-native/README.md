# @link-foundation/ui-react-native

Render Links Notation UI documents with React Native's New Architecture
(React Native >=0.82 and React >=19.1.1). No DOM renderer is imported.

```js
import { createElement } from 'react';
import { UiNativeView } from '@link-foundation/ui-react-native';

const source = `app: document
  body: stack
    greeting: text 'Hello, links'
    ok: button
      label OK
      on press
        navigate home`;

createElement(UiNativeView, {
  source,
  actions: { navigate: (detail) => console.log(detail.action) },
});
```

Install React and React Native in the host app. The native peer is optional in
package metadata so the pure mapping entry can be installed and tested on Node
without React Native. The default entry requires native primitives at runtime.

The renderer uses `@link-foundation/ui-store/memory` to avoid loading optional
persistence adapters in native bundles.

Pass `store` for an existing ui-store store, or inherit it from the DOM-free
`UiProvider`. `store` takes precedence over `source`; each distinct source string
creates a store. Every element has its stable store ID as `testID`. Memoised
elements subscribe with `useUiElement`; child lists subscribe independently so
property changes leave unrelated elements untouched. Subscriptions clean up on
unmount, including StrictMode.

`document`, `stack`, `text`, `button`, and `image` map to `ScrollView`, `View`,
`Text`, `Pressable` with a text label, and `Image`. Unknown kinds fall back to
`View` and warn in development. `components: { chart: MyChart }` overrides a kind
with a component receiving `{ id }`; use the DOM-free ui-react hooks inside it to
read current properties. Image `source` becomes `{ uri }`, and `alt` becomes its
accessibility label. Buttons include role, disabled state, and label text.

`onAction(detail)` and the named `actions` handler receive the shared contract
`{ source, event: 'press', action }`. `emit save` looks up `save`; `navigate home`
looks up `navigate`. Provider actions and `useUiAction` registrations work as in
ui-react. Disabled buttons do not dispatch. Actions are data and never evaluated.

Pass `styles: { ok: { background: '#6750A4', radius: '12px' } }` and `tokens`
(a plain path/value object or the `Map` from ui-tokens `resolveTokens`). Each
style object may be the `style` output of ui-style `resolveStyle`. The host
resolves cascade/environment/state before passing these declarations.
`toNativeStyle` converts px dimensions, colors, numeric values, token references,
layout, typography and borders. Resolved padding, radius and gap lists expand
into their individual native properties. Unsupported properties or values are dropped and
returned in `warnings`; mapping forwards these to the development warning sink
(or an explicit `warn` function). Unsupported units require host conversion.
Button text styles apply to the nested Text primitive.

Pure helpers have separate `@link-foundation/ui-react-native/map` and `/style`
entries. `/renderer` exports `createUiNativeView(primitives)` for injecting native
primitives in tests or another host. Tests use React's matching test renderer
(currently supported but deprecated), without installing React Native.

```sh
node --test packages/ui-react-native/tests/*.test.js
npm --prefix examples/react-native install
npm --prefix examples/react-native run build
```

See [the Expo example](../../examples/react-native/README.md) for web and devices.
