---
'@link-foundation/ui-react': minor
---

Add `@link-foundation/ui-react`, the React adapter: `<UiView>` mounts the ui-dom renderer once and store changes patch the DOM without re-rendering it; `<UiProvider>` and the DOM-free `@link-foundation/ui-react/hooks` entry (`useUiStore`, `useUiElement`, `useUiProp`, `useUiProps`, `useUiAction`) read the store through `useSyncExternalStore`; document actions call `actions` handlers and `onAction`; custom kinds can be React components rendered through portals; `ssr` inlines the escaped static HTML, and an example Vite app shows a counter and a React-rendered chart.
