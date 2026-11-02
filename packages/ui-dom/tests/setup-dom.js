/**
 * Shared helpers of the ui-dom tests: a fresh jsdom window per test (so
 * custom element registries and stylesheets never leak between tests), the
 * issue-1 samples, a store whose active listeners can be counted, and the
 * snapshot check (`UPDATE_SNAPSHOTS=1` rewrites the snapshot).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { URL } from 'node:url';
import { JSDOM } from 'jsdom';
import { createStore } from '@link-foundation/ui-store';

const SAMPLES = new URL(
  '../../../docs/case-studies/issue-1/samples/',
  import.meta.url
);

/** A sample of docs/case-studies/issue-1/samples/ (`document`, `styles`…). */
export const sample = (name) =>
  readFileSync(new URL(`${name}.lino`, SAMPLES), 'utf8');

/**
 * A fresh window with `<div id="app">`; `adopt: true` gives the document
 * an `adoptedStyleSheets` array (jsdom has none), so the adoption path runs.
 */
export function createDom({ adopt = false } = {}) {
  const dom = new JSDOM(
    '<!doctype html><html><head></head><body><div id="app"></div></body></html>'
  );
  const { window } = dom;
  const { document } = window;
  if (adopt) {
    document.adoptedStyleSheets = [];
  }
  return { window, document, container: document.getElementById('app') };
}

/**
 * A store of the text whose `listenerCount()` tells how many `subscribe`
 * listeners are active (ui-store does not expose it).
 */
export function countedStore(text) {
  const store = createStore({ text });
  let active = 0;
  // The store is frozen: wrap it in an object that inherits its methods.
  return Object.create(store, {
    subscribe: {
      value(listener) {
        const unsubscribe = store.subscribe(listener);
        active += 1;
        let done = false;
        return () => {
          if (!done) {
            done = true;
            active -= 1;
          }
          return unsubscribe();
        };
      },
    },
    listenerCount: { value: () => active },
  });
}

/** Every store ID, depth first. */
export function storeIds(store) {
  const ids = [];
  const visit = (id) => {
    ids.push(id);
    store.children(id).forEach(visit);
  };
  store.roots().forEach(visit);
  return ids;
}

/** Wait for queued microtasks (the renderer's patch) to run. */
export const microtasks = () =>
  new Promise((resolve) => setTimeout(resolve, 0));

/** The text of a snapshot file, rewritten first when `UPDATE_SNAPSHOTS=1`. */
export function snapshot(name, actual) {
  const file = new URL(`__snapshots__/${name}`, import.meta.url);
  if (process.env.UPDATE_SNAPSHOTS === '1') {
    writeFileSync(file, actual);
  }
  return readFileSync(file, 'utf8');
}
