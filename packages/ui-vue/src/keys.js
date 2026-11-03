/**
 * Injection keys and the context helpers shared by the plugin, `UiView` and
 * the composables.
 */

import { hasInjectionContext, inject, ssrContextKey } from 'vue';

/**
 * The store (or a ref of it) provided by `createUiPlugin` and `UiView`.
 * @type {import('vue').InjectionKey<object>}
 */
export const UI_STORE_KEY = Symbol('link-foundation.ui-vue.store');

/**
 * The action registry provided by `createUiPlugin` and `UiView`.
 * @type {import('vue').InjectionKey<object>}
 */
export const UI_ACTIONS_KEY = Symbol('link-foundation.ui-vue.actions');

/** The value of an injection key, or `null` outside a setup context. */
export const injected = (key) =>
  hasInjectionContext() ? inject(key, null) : null;

/**
 * Whether the current component renders on the server
 * (`renderToString`/`renderToWebStream` of `vue/server-renderer`), or there
 * is no DOM at all. Nothing subscribes to a store there: a server render
 * never unmounts, so a listener would never be removed.
 */
export const isServer = () =>
  injected(ssrContextKey) !== null || typeof window === 'undefined';

/** Whether development warnings are on (`NODE_ENV` is not `production`). */
export const isDevelopment = () =>
  globalThis.process?.env?.NODE_ENV !== 'production';
