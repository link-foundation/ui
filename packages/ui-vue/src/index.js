/**
 * `@link-foundation/ui-vue`: the Vue 3 adapter of the ui-dom renderer.
 * `UiView` mounts a document, `createUiPlugin` provides a store and action
 * handlers to the app, the composables expose the store as shallow refs,
 * and Vue components render custom kinds. See README.md.
 */

export { UiView, actionNames } from './UiView.js';
export { createUiPlugin, createActionRegistry } from './plugin.js';
export {
  useUiStore,
  useUiElement,
  useUiProp,
  useUiAction,
  propOf,
} from './composables.js';
export { UI_STORE_KEY, UI_ACTIONS_KEY } from './keys.js';
export {
  isUiCustomElement,
  UI_VUE_HOST_TAG,
  hostKinds,
} from './custom-elements.js';
export { renderStaticHTML, storeFromSource } from './ssr.js';
