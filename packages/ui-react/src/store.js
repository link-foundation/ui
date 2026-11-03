/**
 * The store of a `<UiView>`: the `store` prop, else a store of the `source`
 * text (parsed once per distinct string), else the store of the provider.
 */

import { parse } from '@link-foundation/ui-core';
import { createStore } from '@link-foundation/ui-store';

/**
 * A store of Links Notation text with the parse diagnostics.
 * @param {string} source
 * @param {object} [parseOptions]  ui-core `parse` options
 */
export function storeOfSource(source, parseOptions) {
  const parsed = parse(source, parseOptions);
  return {
    store: createStore({ document: parsed }),
    diagnostics: parsed.diagnostics,
  };
}

/** Whether two plain option objects have the same values (one level). */
export function shallowEqual(a, b) {
  if (a === b) {
    return true;
  }
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => Object.hasOwn(b, key) && Object.is(a[key], b[key]))
  );
}
