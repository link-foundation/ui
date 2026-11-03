// Type-check of the ui-vue declarations, as a TypeScript consumer sees them
// through `exports["."].types`: `deno check experiments/ui-vue-types/check.ts`.
// A wrong annotation below (say `ShallowRef<string>` for `count`) must fail.
// vue is a dependency of packages/ui-vue, not of the repository root.
import type { ShallowRef } from '../../packages/ui-vue/node_modules/vue/dist/vue.d.mts';
// @deno-types="../../packages/ui-vue/src/index.d.ts"
import {
  UI_ACTIONS_KEY,
  UI_STORE_KEY,
  UiView,
  createUiPlugin,
  isUiCustomElement,
  storeFromSource,
  useUiAction,
  useUiElement,
  useUiProp,
  useUiStore,
} from '../../packages/ui-vue/src/index.js';

const store = storeFromSource("(app: document (ok: button (label 'OK')))");
const plugin = createUiPlugin({ store, actions: { save: () => {} } });
const label: Readonly<ShallowRef<readonly unknown[] | undefined>> = useUiProp(
  'ok',
  'label',
  store
);
const count: Readonly<ShallowRef<number>> = useUiStore(() => 1, store);
const element = useUiElement('ok', store);
const off: () => boolean = useUiAction('save', () => {});
const isCustom: boolean = isUiCustomElement('ui-button');
export {
  UI_ACTIONS_KEY,
  UI_STORE_KEY,
  UiView,
  count,
  element,
  isCustom,
  label,
  off,
  plugin,
};
