/**
 * Shared helpers of the ui-components DOM tests: a fresh jsdom window per
 * test (no globals), and keyboard events.
 */

import { JSDOM } from 'jsdom';

/** A fresh window with `<div id="app">`. */
export function createDom(body = '<div id="app"></div>') {
  const { window } = new JSDOM(
    `<!doctype html><html><body>${body}</body></html>`
  );
  const { document } = window;
  return { window, document, container: document.getElementById('app') };
}

/** Dispatch a keydown (and keyup) of `key` on `target`; returns the keydown. */
export function press(target, key, init = {}) {
  const win = target.ownerDocument.defaultView;
  const down = new win.KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(down);
  target.dispatchEvent(
    new win.KeyboardEvent('keyup', {
      key,
      bubbles: true,
      cancelable: true,
      ...init,
    })
  );
  return down;
}

/** Timer turns `microtasks()` waits (see there why more than one). */
const TURNS = 3;

/**
 * Wait for queued microtasks (the renderer's patch, the refresh of a
 * `watchChildren` observer) to run. One `setTimeout(0)` is enough in
 * Node, but not in Deno: there jsdom's MutationObserver notification runs
 * from the Node-compat tick drain, and the microtask its callback queues
 * can run after an expired timer of the same drain (#34, see
 * `experiments/radio-group-deno-flake.probe.mjs`). A few timer turns let
 * every chained microtask run on both.
 */
export async function microtasks() {
  for (let turn = 0; turn < TURNS; turn++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}
