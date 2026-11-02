/**
 * `@link-foundation/ui-dom`: the reference DOM renderer. A ui-store
 * document renders as plain custom elements in the light DOM
 * (`ui-document`, `ui-stack`, `ui-text`, `ui-button`, …), each carrying its
 * store ID in `data-link-id`, and is patched incrementally from store
 * events. See README.md.
 */

import { parse } from '@link-foundation/ui-core';
import { createStore } from '@link-foundation/ui-store';
import './kinds/basic.js';
import { render } from './render.js';

export { render };
export { renderToHTML, escapeHtml } from './html.js';
export {
  defineKind,
  getKind,
  registeredKinds,
  isCustomElementName,
} from './kinds.js';
export { UNKNOWN_KIND } from './kinds/basic.js';
export { DOM_EVENTS } from './events.js';
export { BASE_CSS, buildCss } from './styles.js';
export { isUnsafeUrl } from './diagnostics.js';

/**
 * Parse Links Notation, create a store and render it.
 * @param {Element} container
 * @param {string} text
 * @param {import('./render.js').RenderOptions & {parseOptions?: object,
 *   storeOptions?: object}} [options]  `parseOptions` go to ui-core
 *   `parse`, `storeOptions` to ui-store `createStore`
 */
export function mountDocument(container, text, options = {}) {
  const parsed = parse(text, options.parseOptions);
  parsed.diagnostics.forEach((d) => options.onDiagnostic?.(d));
  const store = createStore({ ...options.storeOptions, document: parsed });
  const handle = render(container, store, options);
  return {
    store,
    handle,
    diagnostics: [...parsed.diagnostics, ...handle.diagnostics],
  };
}
