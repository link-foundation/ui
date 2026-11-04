/**
 * Shared helpers of the layout kind tests: a fresh jsdom window per mount,
 * a memory storage, key and pointer events, and a microtask flush (the
 * dock and the region kinds reload in a microtask).
 */

import { JSDOM } from 'jsdom';
import { mountDocument } from '@link-foundation/ui-dom';
import { layoutVocabulary } from '@link-foundation/ui-components';

/** A `localStorage`-like storage kept in a Map. */
export function memoryStorage(entries = {}) {
  const map = new Map(Object.entries(entries));
  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
  };
}

/** Set the viewport size of a jsdom window. */
export function setViewport(window, width, height = 800) {
  Object.defineProperty(window, 'innerWidth', {
    value: width,
    configurable: true,
  });
  Object.defineProperty(window, 'innerHeight', {
    value: height,
    configurable: true,
  });
}

/** Let the queued microtasks run. */
export const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Mount a layout document in a fresh window.
 * @param {string} text
 * @param {{storage?: object, width?: number, height?: number,
 *   render?: object}} [options]
 */
export async function mountLayout(text, options = {}) {
  const dom = new JSDOM(
    '<!doctype html><html><body><button id="opener">Open</button><div id="app"></div></body></html>',
    { pretendToBeVisual: true }
  );
  const { window } = dom;
  const errors = [];
  window.addEventListener('error', (event) => errors.push(event.error));
  setViewport(window, options.width ?? 1280, options.height ?? 800);
  const storage = options.storage ?? memoryStorage();
  const diagnostics = [];
  const { store, handle } = mountDocument(
    window.document.getElementById('app'),
    text,
    {
      parseOptions: { vocabulary: layoutVocabulary() },
      layout: { storage, ...options.layout },
      onDiagnostic: (d) => diagnostics.push(d),
      ...options.render,
    }
  );
  await flush();
  return {
    window,
    document: window.document,
    store,
    handle,
    storage,
    diagnostics,
    errors,
    node: (id) => handle.nodeFor(id),
    close: () => {
      handle.destroy();
      window.close();
    },
  };
}

/** Dispatch a keydown on an element. */
export function press(target, key, modifiers = {}) {
  const event = new target.ownerDocument.defaultView.KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...modifiers,
  });
  target.dispatchEvent(event);
  return event;
}

/** Dispatch a pointer event (jsdom has no PointerEvent: a MouseEvent). */
export function pointer(target, type, init = {}) {
  const view = target.ownerDocument.defaultView;
  const event = new view.MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    ...init,
  });
  Object.defineProperty(event, 'pointerId', { value: init.pointerId ?? 1 });
  target.dispatchEvent(event);
  return event;
}

/** The tab texts of a tab strip root. */
export const tabTitles = (root) =>
  [...root.querySelectorAll('[role=tab]')].map(
    (tab) => tab.querySelector('.ui-tab-title').textContent
  );
