/**
 * Shared helpers of the basic control tests: mount controls in a fresh
 * jsdom window and read their parts, the store and the events they send.
 */

import { mountControls } from '../../src/controls/index.js';
import { createDom, microtasks, press } from './dom.js';

export { microtasks, press };

/**
 * Mount the elements (Links Notation lines) as one document.
 * @param {string} elements
 * @param {object} [options]  more `mountControls` options
 */
export function mountDoc(elements, options = {}) {
  const { window, document, container } = createDom();
  const actions = [];
  const changes = [];
  const emitted = [];
  container.addEventListener('ui-change', (event) =>
    changes.push(event.detail)
  );
  container.addEventListener('ui-emit', (event) => emitted.push(event.detail));
  const mounted = mountControls(container, `(app: document\n${elements})`, {
    ...options,
    onAction: (detail) => actions.push(`${detail.source}:${detail.event}`),
  });
  const transactions = [];
  mounted.store.subscribe((events) => transactions.push(events));
  const node = (id) => mounted.handle.nodeFor(id);
  return {
    window,
    document,
    container,
    mounted,
    actions,
    changes,
    emitted,
    transactions,
    node,
    /** The `data-part` element of a control. */
    part: (id, name) => node(id).querySelector(`[data-part="${name}"]`),
    /** The values of a property in the store. */
    prop: (id, name) =>
      mounted.store.get(id).properties.find((p) => p.name === name)?.values,
    /** The diagnostics as `code@element:property`. */
    codes: () =>
      mounted.diagnostics.map(
        (d) => `${d.code}@${d.at?.element}:${d.at?.property ?? ''}`
      ),
  };
}

/** Set a text input's value and send `input` (as typing does). */
export function typeInto(input, value) {
  const win = input.ownerDocument.defaultView;
  input.value = value;
  input.dispatchEvent(new win.Event('input', { bubbles: true }));
}

/** Send `change` (as leaving a typed-in field does). */
export function commit(input) {
  const win = input.ownerDocument.defaultView;
  input.dispatchEvent(new win.Event('change', { bubbles: true }));
}

/** The attributes of a node, by name (`null` when missing). */
export const attrs = (node, names) =>
  Object.fromEntries(names.map((name) => [name, node.getAttribute(name)]));
