/**
 * Shared helpers of the ui-react tests. Importing this module installs a
 * jsdom window as the globals React DOM needs and sets
 * `IS_REACT_ACT_ENVIRONMENT`, so every render runs inside `act`. Under
 * `node --test` and `deno test` each test file runs in its own process or
 * worker; `bun test` runs every file in one process, where the globals stay
 * installed after this file is loaded (ssr.test.js hides them for its
 * window-less test).
 */

import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { JSDOM } from 'jsdom';
import { createStore } from '@link-foundation/ui-store';

const dom = new JSDOM(
  '<!doctype html><html><head></head><body></body></html>',
  {
    pretendToBeVisual: true,
  }
);

const GLOBALS = [
  'window',
  'document',
  'navigator',
  'Node',
  'Element',
  'HTMLElement',
  'HTMLIFrameElement',
  'Event',
  'CustomEvent',
  'MouseEvent',
  'getComputedStyle',
  'requestAnimationFrame',
  'cancelAnimationFrame',
];
for (const name of GLOBALS) {
  const value = name === 'window' ? dom.window : dom.window[name];
  Object.defineProperty(globalThis, name, {
    value:
      typeof value === 'function' && /^[a-z]/.test(name)
        ? value.bind(dom.window)
        : value,
    configurable: true,
    writable: true,
  });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { act, createElement } = await import('react');
const { createRoot } = await import('react-dom/client');

export { act, createElement as h };

const SAMPLES = new URL(
  '../../../docs/case-studies/issue-1/samples/',
  import.meta.url
);

/** A sample of docs/case-studies/issue-1/samples/ (`document`, …). */
export const sample = (name) =>
  readFileSync(new URL(`${name}.lino`, SAMPLES), 'utf8');

/**
 * Render a React element into a fresh container inside `act`.
 * @returns {Promise<{container: HTMLElement, rerender: (element: any) =>
 *   Promise<void>, unmount: () => Promise<void>}>}
 */
export async function mount(element) {
  const container = dom.window.document.createElement('div');
  dom.window.document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(element));
  return {
    container,
    rerender: (next) => act(async () => root.render(next)),
    async unmount() {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

/** Run a store change inside `act`, so the ui-dom patch (a microtask) and
 * the React updates it causes are applied before the next assertion. */
export const change = (fn) =>
  act(async () => {
    fn();
  });

/**
 * A store of the text whose `listenerCount()` is the number of active
 * `subscribe` listeners (ui-store does not expose it).
 */
export function trackedStore(text) {
  const store = createStore({ text });
  const live = new Set();
  return Object.create(store, {
    subscribe: {
      value(listener) {
        const token = {};
        live.add(token);
        const unsubscribe = store.subscribe(listener);
        return () => {
          live.delete(token);
          return unsubscribe();
        };
      },
    },
    listenerCount: { value: () => live.size },
  });
}

/** Click a node like a user (a bubbling `click` event). */
export const click = (node) =>
  act(async () => {
    node.dispatchEvent(
      new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })
    );
  });
