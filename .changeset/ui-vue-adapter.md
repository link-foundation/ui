---
'@link-foundation/ui-vue': minor
---

Add `@link-foundation/ui-vue`, the Vue 3 adapter of the ui-dom renderer: a `UiView` component (`source`, `store`, `actions`, `components`, `ssr` and `options` props, and an `action` emit) whose render function never re-runs for store changes, `createUiPlugin({ store, actions })` providing the store and an action registry under the `UI_STORE_KEY` and `UI_ACTIONS_KEY` symbols, the composables `useUiStore`, `useUiElement`, `useUiProp` and `useUiAction` returning read-only shallow refs that unsubscribe on scope dispose, Vue components for custom kinds rendered through `Teleport` into ui-dom hosts, `isUiCustomElement` for the Vue compiler, server rendering without `window` (the `ssr` prop inlines `renderToHTML`), type declarations, and a Vite + Vue example app.
