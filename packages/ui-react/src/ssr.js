/**
 * Server rendering: the static HTML of a store, from ui-dom
 * `renderToHTML` (DOM-free, every text escaped). `<UiView ssr>` inlines it
 * in its container; on mount the client clears it and renders live nodes
 * (no hydration of the server nodes).
 */

import { renderToHTML } from '@link-foundation/ui-dom/html';
import { withHostKinds } from './components.js';

/**
 * The static HTML of a store. Kinds rendered by React components become
 * empty `<ui-react-host data-kind=...>` elements with their children.
 * @param {import('@link-foundation/ui-store').Store} store
 * @param {{kinds?: Map<string, object>|Record<string, object>, componentKinds?: readonly string[],
 *   prefix?: string, onDiagnostic?: (diagnostic: object) => void}} [options]
 * @returns {string}
 */
export function renderViewToHTML(store, options = {}) {
  const { componentKinds = [], kinds, ...rest } = options;
  return renderToHTML(store, {
    ...rest,
    kinds: withHostKinds(kinds, componentKinds, null),
  });
}
