/**
 * `@link-foundation/ui-react`: the React adapter of the associative UI
 * framework. `<UiView>` mounts the ui-dom renderer and React stays
 * thin: it renders the container once, subscribes to the store through
 * hooks and renders React components for custom dialect kinds. See
 * README.md.
 *
 * The hooks are also published alone as `@link-foundation/ui-react/hooks`
 * (no `react-dom`, no `ui-dom`) for non-DOM renderers.
 */

export { UiView } from './UiView.js';
export {
  UiContext,
  UiProvider,
  useUiContext,
  useUiStore,
  useUiElement,
  useUiProp,
  useUiProps,
  useUiAction,
  createActionRegistry,
  propsOf,
  propOf,
} from './hooks.js';
export {
  HOST_TAG,
  SLOT_TAG,
  createHostRegistry,
  hostKind,
} from './components.js';
export { renderViewToHTML } from './ssr.js';
export { storeOfSource } from './store.js';
