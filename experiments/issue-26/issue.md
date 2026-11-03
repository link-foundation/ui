## Context

Issue #1 requires the framework to be usable from React (R19). Most of our UI
projects are React today: formal-ai (React 19 + Chakra), meta-sovereign,
immortality, anime-avatar, konard.github.io and deepcase (see the research
files). The architecture keeps React thin: the DOM renderer `ui-dom`
(#24) does the rendering, and React only mounts it, subscribes to the store
and lets React components render custom kinds
([ARCHITECTURE.md](https://github.com/link-foundation/ui/blob/main/docs/ARCHITECTURE.md),
"Framework adapters"). React 19 supports custom elements natively, so the
`ui-*` tags can also be written in JSX
([existing-solutions.md](https://github.com/link-foundation/ui/blob/main/docs/case-studies/issue-1/research/existing-solutions.md)
section 1, "Web Components").

The hooks must not depend on the DOM, because the React Native renderer
(#28) reuses them.

## Goal

Publish `@link-foundation/ui-react` with a `<UiView>` component, a
provider, DOM-free store hooks and a way to render React components for
custom dialect kinds.

## Scope

### In scope

- `<UiView source | store, actions, onAction, components, className />`
  that mounts `ui-dom` into a container `<div>` and cleans up on unmount.
- `<UiProvider store actions>` and `useUiContext()`.
- Hooks (entry `@link-foundation/ui-react/hooks`, no `react-dom`, no
  `ui-dom` import): `useUiStore(store, selector)`, `useUiElement(id)`,
  `useUiProp(id, name)`, `useUiAction(name, handler)`.
- `components` prop: `{ chart: MyChart }` registers a `ui-dom` kind whose
  node is a host element, and React renders `MyChart` into it with
  `createPortal`, receiving `{ id, props, children }`.
- Server rendering safety: `renderToString(<UiView source=... />)` does
  not touch `window`; with `ssr` it inlines `renderToHTML` output from
  #24, which is replaced on mount.
- Type declarations (`src/index.d.ts`) and an example Vite app.

### Out of scope

- Re-implementing rendering in React (no per-element React components for
  built-in kinds).
- React Native (#28), code export to React source (#60), MUI theme
  mapping (#48), JSX import (#59).
- Hydration that reuses server nodes.

## Dependencies

- #24 (blocker): `render(container, store, options)`, `RenderHandle`,
  `defineKind`, `renderToHTML`, the `ui-action` event and `onAction`
  callback.
- Indirect: #16 store (`subscribe`, `getSnapshot`-like read, `transaction`),
  #14 `parse` for `source` strings.
- Related: #27 (same shape for Vue; keep names parallel), #28,
  #33 (actions registry; `actions` prop accepts its registry once
  merged, a plain `{ name: fn }` object before that), #60.

## Step-by-step plan

1. Create `packages/ui-react/package.json`: name `@link-foundation/ui-react`,
   `"type": "module"`, `exports` `.` (component and hooks) and `./hooks`
   (hooks only). `peerDependencies`: `react` and `react-dom` `>=18` (test
   against 19). Dependencies: `@link-foundation/ui-dom`,
   `@link-foundation/ui-store`, `@link-foundation/ui-core`.
2. `src/hooks.js` (imports only `react` and `ui-store`):
   ```js
   /**
    * Subscribe to a store slice. Uses useSyncExternalStore.
    * @template T
    * @param {Store} store
    * @param {(store: Store) => T} selector  must return a cached value when nothing changed
    * @returns {T}
    */
   export function useUiStore(store, selector) {}
   /** @param {string} id @returns {UiNode | undefined} */
   export function useUiElement(id) {}
   /** @param {string} id @param {string} name */
   export function useUiProp(id, name) {}
   /** Register an action handler while the component is mounted. */
   export function useUiAction(name, handler) {}
   ```
   Pass `getServerSnapshot` so the hooks work during SSR.
3. `src/context.js`: `UiContext`, `UiProvider({ store, actions, children })`,
   `useUiContext()`; an action registry fallback that maps names to functions
   and ignores unknown names with a `console.warn` in development.
4. `src/UiView.js`: create or receive a store (`source` is parsed once
   per distinct string), render a `<div data-ui-root>` with a ref, call
   `render` from `ui-dom` in `useLayoutEffect`
   (`useEffect` on the server path), call `handle.destroy()` on cleanup. Must
   be safe under `<StrictMode>` (mount, unmount, mount).
5. `src/components.js`: for each entry of `components`, call `defineKind` with a
   spec whose `create` returns a `<ui-react-host data-kind=...>` element and
   records it in a state list; `UiView` renders
   `createPortal(<Comp id props />, host)` for each recorded host. Props come
   from `useUiElement(id)` so they update incrementally.
6. Actions: listen for `ui-action` on the container and call
   `onAction(detail)` and the matching handler from `actions` / the provider.
7. SSR: when `ssr` is true and `typeof window === 'undefined'`, render
   `<div data-ui-root dangerouslySetInnerHTML={{ __html: renderToHTML(...) }}>`;
   on the client clear and render. The HTML comes only from `renderToHTML`,
   which escapes all text.
8. Example `examples/react/` (Vite + React) rendering
   `samples/document.lino`, a counter that changes `greeting` through the
   store, and a custom kind rendered by a React component.
9. Tests (below), README with a quick start, changeset.

## Files to create or change

- `packages/ui-react/package.json`, `README.md`, `src/index.js`,
  `src/index.d.ts`, `src/hooks.js`, `src/context.js`, `src/UiView.js`,
  `src/components.js`, `src/ssr.js`
- `packages/ui-react/tests/setup-dom.js` (jsdom globals and
  `globalThis.IS_REACT_ACT_ENVIRONMENT = true`)
- `packages/ui-react/tests/{hooks,document,components,actions,strict-mode,ssr,no-dom-hooks}.test.js`
- `examples/react/{index.html,main.jsx,package.json,vite.config.js}`
- `.changeset/<name>.md`

Example usage:

```jsx
import { UiView } from '@link-foundation/ui-react';

<UiView
  source={
    "(app: document (body: stack (ok: button (label 'OK') (on press (save)))))"
  }
  actions={{ save: () => console.log('saved') }}
/>;
```

## Acceptance criteria

- [ ] `document.test.js`: `<UiView source=...>` renders `ui-button`
      with `data-link-id="ok"` inside the container (jsdom, `act`).
- [ ] Changing a prop in the store updates the DOM without re-rendering the
      `UiView` React component (render counter stays at 1).
- [ ] `hooks.test.js`: `useUiProp('greeting', 'text')` re-renders only when
      that prop changes (a change to another element does not re-render).
- [ ] `actions.test.js`: clicking `ok` calls `actions.save` once and
      `onAction` with the F16 detail object; unknown actions only warn.
- [ ] `components.test.js`: a `chart` kind is rendered by a React component
      through a portal and receives updated props after a store change.
- [ ] `strict-mode.test.js`: under `<StrictMode>` there is exactly one
      rendered tree and no store listener leaks after unmount.
- [ ] `ssr.test.js`: `renderToString` works without `window`; with `ssr` the
      string contains `data-link-id="ok"`.
- [ ] `no-dom-hooks.test.js`: importing `@link-foundation/ui-react/hooks`
      loads no module from `react-dom` or `ui-dom` (checked with a module
      graph walk or by running the import with no DOM globals).
- [ ] The example app builds (`npm --prefix examples/react run build`) and a
      screenshot is attached to the pull request.
- [ ] `npm run lint`, `npm run format:check`, `npm run check:duplication` and
      `npm test` pass.

## How to verify

```bash
npm install
node --test packages/ui-react/tests/*.test.js
npm --prefix examples/react install && npm --prefix examples/react run build
npm test && npm run lint && npm run format:check && npm run check:duplication
```

## Prior art and libraries

- React `useSyncExternalStore` (MIT) — the pattern konard.github.io already
  uses for language and theme stores without a provider
  ([konard-github-io-and-links-visuals.md](https://github.com/link-foundation/ui/blob/main/docs/case-studies/issue-1/research/konard-github-io-and-links-visuals.md)
  pattern 17).
- Stencil React output target and Lit's `@lit/react` wrapper (learn).
- lino-i18n React adapter (`T`, `Var`) as an example of a thin React layer
  over a LiNo package
  ([links-notation-ecosystem.md](https://github.com/link-foundation/ui/blob/main/docs/case-studies/issue-1/research/links-notation-ecosystem.md)
  section 3).
- deepcase `ClientHandlerRenderer` and perception `createComponent`: what to
  replace — they `eval` TSX; we render data
  ([deepcase.md](https://github.com/link-foundation/ui/blob/main/docs/case-studies/issue-1/research/deepcase.md)
  sections 2.1, 2.5 and 10).

## References

- https://github.com/link-foundation/ui/blob/main/docs/ARCHITECTURE.md
- https://github.com/link-foundation/ui/blob/main/docs/case-studies/issue-1/research/existing-solutions.md
- https://react.dev/reference/react/useSyncExternalStore
- https://react.dev/reference/react-dom/createPortal

## Conventions for every roadmap issue

This issue is part of the roadmap planned in #1. The full plan, the
requirement list and the research are in the
[issue 1 case study](https://github.com/link-foundation/ui/tree/main/docs/case-studies/issue-1),
and the target design is in
[`docs/ARCHITECTURE.md`](https://github.com/link-foundation/ui/blob/main/docs/ARCHITECTURE.md).

- **Read first:** `AGENTS.md`, `docs/CONTRIBUTING.md`,
  `docs/javascript-first.md` and `docs/ARCHITECTURE.md`.
- **Links Notation first.** Every new format (documents, configuration,
  tokens, styles, animations, recordings, asset records) is Links Notation
  parsed with the official `links-notation` package (or the official port for
  Swift and Kotlin). Never hand-write a LiNo parser with regular expressions.
  JSON, CSS, JSX and so on are only import or export formats.
- **JavaScript first.** Plain ES modules (`.js`/`.mjs`) with JSDoc types;
  TypeScript declaration files (`.d.ts`) are allowed for public APIs. Swift and
  Kotlin ports must pass the same shared fixtures as the JavaScript code.
- **Tests:** `node --test` (see `package.json`). Every behaviour change has a
  test that fails before the change. Keep tests deterministic: no network, no
  real clock (inject time), no random seeds without a fixed value.
- **Quality gates:** `npm run lint`, `npm run format:check`,
  `npm run check:duplication` and `npm test` must pass. Files stay under
  1,500 lines (`scripts/check-file-line-limits.sh`).
- **Releases:** a change to a published package needs a changeset
  (`npx changeset`), as described in `docs/CONTRIBUTING.md`.
- **Licensing:** the repository is public domain (Unlicense). Our own assets
  are CC0-1.0. A third-party dependency or asset must use a permissive licence
  (MIT, ISC, BSD, Apache-2.0, CC0, CC-BY with attribution recorded) and be
  recorded as described in the licensing issue. Do not add GPL, AGPL,
  non-commercial or "source available" code or assets.
- **Accessibility:** interactive UI follows the WAI-ARIA Authoring Practices,
  works with the keyboard, respects `prefers-reduced-motion` and
  `prefers-color-scheme`, and meets WCAG 2.2 AA contrast.
- **Scope discipline:** do only what this issue asks. If you find a defect or
  a missing prerequisite, open a new issue (type Bug or Feature) and link it,
  instead of widening this pull request.
- **Done means:** every acceptance criterion is checked, CI is green, and the
  pull request description says `Fixes #<this issue>` and shows how each
  criterion was verified (command output or screenshots for UI).
