/**
 * Server rendering. `UiView` never touches `window` during
 * `renderToString`: it renders an empty root, or with the `ssr` prop the
 * static markup of ui-dom `renderToHTML` inlined in the root. On the client
 * the root is cleared and rendered by ui-dom `render` when it mounts, so
 * hydration keeps working.
 */

import { parse } from '@link-foundation/ui-core';
import { renderToHTML } from '@link-foundation/ui-dom';
import { createStore } from '@link-foundation/ui-store';
import { hostKinds, withHostKinds } from './custom-elements.js';

/**
 * A store of Links Notation text, like ui-dom `mountDocument`: parse
 * diagnostics go to `onDiagnostic`, `parseOptions` to ui-core `parse` and
 * `storeOptions` to ui-store `createStore`.
 * @param {string} text
 * @param {{onDiagnostic?: (diagnostic: object) => void,
 *   parseOptions?: object, storeOptions?: object}} [options]
 */
export function storeFromSource(text, options = {}) {
  const parsed = parse(text, options.parseOptions);
  parsed.diagnostics.forEach((d) => options.onDiagnostic?.(d));
  return createStore({ ...options.storeOptions, document: parsed });
}

/**
 * The static HTML of a store: the ui-dom markup, with an empty
 * `<ui-vue-host>` for each kind of `components` (the Vue components render
 * into them once the view mounts on the client).
 * @param {object} store
 * @param {{kinds?: object, onDiagnostic?: Function, prefix?: string}} [options]
 * @param {Record<string, unknown>} [components]
 */
export function renderStaticHTML(store, options = {}, components = {}) {
  return renderToHTML(store, {
    kinds: withHostKinds(options.kinds, hostKinds(components)),
    onDiagnostic: options.onDiagnostic,
    prefix: options.prefix,
  });
}
