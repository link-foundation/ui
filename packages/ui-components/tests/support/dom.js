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

/** Wait for queued microtasks (the renderer's patch) to run. */
export const microtasks = () =>
  new Promise((resolve) => setTimeout(resolve, 0));
