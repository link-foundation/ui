/**
 * Shared helpers of the ui-devmode tests: the issue-1 samples, the policy of
 * the issue, and a fresh jsdom window with the sample page mounted by ui-dom
 * and bound to a ui-config configuration.
 */

import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { JSDOM } from 'jsdom';
import { parse } from '@link-foundation/ui-core';
import { createConfig } from '@link-foundation/ui-config';
import { mountDocument } from '@link-foundation/ui-dom';

const SAMPLES = new URL(
  '../../../docs/case-studies/issue-1/samples/',
  import.meta.url
);

/** A sample of docs/case-studies/issue-1/samples/ (`document`, `styles`…). */
export const sample = (name) =>
  readFileSync(new URL(`${name}.lino`, SAMPLES), 'utf8');

/** The site policy of the issue. */
export const POLICY = `(site-dev-mode: dev-mode
  (enabled true)
  (entry shortcut url-parameter element)
  (shortcut 'Alt+Shift+D')
  (write-layers session user)
  (locked-elements payment-form))`;

/** A fresh window (`url` sets `location`) with `<div id="app">`. */
export function createDom({ url = 'http://localhost/', body = '' } = {}) {
  const dom = new JSDOM(
    `<!doctype html><html><head></head><body><div id="app"></div>${body}</body></html>`,
    { url, pretendToBeVisual: true }
  );
  const { window } = dom;
  return {
    window,
    document: window.document,
    root: window.document.getElementById('app'),
  };
}

/**
 * The sample page: `document.lino` rendered by ui-dom into `#app`, its
 * configuration (`document.lino` as the site layer) bound to the store, and
 * the `on press` actions the app received.
 */
export function createPage(options = {}) {
  const dom = createDom(options);
  const text = sample('document');
  const actions = [];
  const { store, handle } = mountDocument(dom.root, text, {
    styles: sample('styles'),
    tokens: sample('tokens'),
    setTitle: false,
    onAction: (detail) => actions.push(detail),
  });
  const config = createConfig({ document: parse(text) });
  config.bindStore(store);
  return { ...dom, text, store, handle, config, actions };
}

/** Wait for queued tasks (renders, coalesced refreshes) to run. */
export const tick = (ms = 0) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wait until `condition()` holds, for things behind a dynamic `import()`
 * (opening dev mode), whose time depends on the machine load.
 */
export async function waitFor(condition, { timeout = 5000, step = 10 } = {}) {
  for (let waited = 0; !condition(); waited += step) {
    if (waited >= timeout) {
      throw new Error(`Condition not met within ${timeout} ms`);
    }
    await tick(step);
  }
}

/** A key event of the window. */
export const key = (window, init) =>
  new window.KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    composed: true,
    ...init,
  });

/** The Alt+Shift+D key event. */
export const shortcut = (window) =>
  key(window, { key: 'D', code: 'KeyD', altKey: true, shiftKey: true });
