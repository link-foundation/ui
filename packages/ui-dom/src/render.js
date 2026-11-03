/**
 * `render(container, store, options)`: render a ui-store document as
 * custom elements in `container` and keep it in sync. Store events are
 * patched in one microtask per task (`flush()` patches synchronously), and the
 * stylesheet is adopted a single time per root node.
 */

import { applyEvents } from './patch.js';
import { createScheduler } from './scheduler.js';
import { adoptStyles, buildCss } from './styles.js';
import { createTree } from './tree.js';
import { atom, elementOf } from './model.js';

/**
 * @typedef {import('@link-foundation/ui-store').Store} Store
 *
 * @typedef {object} RenderOptions
 * @property {Map<string, import('./kinds.js').KindSpec>|
 *   Record<string, import('./kinds.js').KindSpec>} [kinds]  kind
 *   renderers of this render, before the registry
 * @property {(detail: {source: string|null, event: string,
 *   action: readonly any[]}, event: Event) => void} [onAction]
 * @property {(name: string) => boolean} [isAction]  which action names
 *   handlers may use (default: the vocabulary actions); others are
 *   reported as `unknown-action` and never dispatched
 * @property {(diagnostic: object) => void} [onDiagnostic]
 * @property {(events: readonly object[]) => void} [onPatch]  called once
 *   per applied patch with its store events
 * @property {boolean} [setTitle]  set `document.title` from the document
 * @property {string|object|Map<string, any>} [tokens]  ui-tokens LiNo text,
 *   `{ sets }` of `readTokens`, or resolved tokens
 * @property {string} [theme]  the token set (default: the document's
 *   `theme`, else the first set)
 * @property {string|object[]} [styles]  ui-style LiNo text or read rules
 * @property {string} [css]  extra CSS appended to the sheet
 * @property {string} [prefix]  the CSS custom property prefix
 * @property {boolean} [baseCss]  `false` leaves out the base rules
 * @property {boolean} [adoptStyles]  `false` applies no stylesheet
 */

/** The `theme` of the first document element of the store. */
function documentTheme(store) {
  for (const id of store.roots()) {
    const view = store.get(id);
    if (view?.kind === 'document') {
      return atom(elementOf(view), 'theme');
    }
  }
  return undefined;
}

/**
 * @param {Element} container
 * @param {Store} store
 * @param {RenderOptions} [options]
 */
export function render(container, store, options = {}) {
  const document = container.ownerDocument;
  const diagnostics = [];
  const report = (d) => {
    diagnostics.push(d);
    options.onDiagnostic?.(d);
  };

  const styles =
    options.adoptStyles === false
      ? null
      : adoptStyles(container, buildCss(options, documentTheme(store), report));

  const tree = createTree({
    document,
    container,
    options,
    interactive: true,
    report,
  });
  tree.mount(store);

  const scheduler = createScheduler((events) => {
    applyEvents(tree, events, report);
    options.onPatch?.(events);
  });
  let unsubscribe = store.subscribe((events) => scheduler.schedule(events));

  return {
    store,
    diagnostics,
    styles,
    /** The node of a store ID; `null` when it has none. */
    nodeFor: tree.nodeFor,
    /** The store ID of a node or of its closest rendered ancestor. */
    idFor: tree.idFor,
    /** Apply the pending store events now; returns how many there were. */
    flush: () => scheduler.flush(),
    /** Remove every node, the store listener and the stylesheet. */
    destroy() {
      if (unsubscribe === null) {
        return;
      }
      scheduler.cancel();
      unsubscribe();
      unsubscribe = null;
      tree.clear();
      styles?.release();
    },
  };
}
