/**
 * Shared helpers of the ui-vue tests.
 *
 * Vue's DOM runtime reads the global `document` a single time, when `vue` is
 * evaluated, and runtimes may evaluate CommonJS dependencies (Vue's Node
 * build) before the ES modules that import them run. So this module
 * installs the globals of one jsdom window per process first and only then
 * loads `vue`, `@vue/test-utils` and `@link-foundation/ui-vue` with dynamic
 * imports; the tests take them from here.
 * `useDom()` re-installs the globals before the tests of a file and removes
 * them afterwards, so the window never leaks into the tests of other
 * packages when a runtime (Bun) runs every test file in one process.
 */

import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { JSDOM } from 'jsdom';
import { afterAll, afterEach, beforeAll } from 'test-anywhere';
import { createStore } from '@link-foundation/ui-store';

const SAMPLES = new URL(
  '../../../docs/case-studies/issue-1/samples/',
  import.meta.url
);

/** A sample of docs/case-studies/issue-1/samples/ (`document`, …). */
export const sample = (name) =>
  readFileSync(new URL(`${name}.lino`, SAMPLES), 'utf8');

/** The window globals Vue, @vue/test-utils and ui-dom use. */
const GLOBALS = [
  'window',
  'document',
  'navigator',
  'Node',
  'Text',
  'Comment',
  'Element',
  'HTMLElement',
  'SVGElement',
  'MathMLElement',
  'DocumentFragment',
  'ShadowRoot',
  'Event',
  'CustomEvent',
  'MouseEvent',
  'KeyboardEvent',
  'customElements',
  'getComputedStyle',
];

const KEY = Symbol.for('link-foundation.ui-vue.tests.dom');
// One window per process: Vue keeps the document it saw at import time.
const dom = (globalThis[KEY] ??= new JSDOM(
  '<!doctype html><html><head></head><body></body></html>',
  { pretendToBeVisual: true }
));

/** The shared jsdom window. */
export const window = dom.window;

const saved = new Map();

/** Install the window globals (the previous values are kept). */
export function installDom() {
  for (const name of GLOBALS) {
    if (!saved.has(name)) {
      saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    }
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value: name === 'window' ? window : window[name],
    });
  }
}

/** Restore the globals as they were before `installDom()`. */
export function removeDom() {
  for (const [name, descriptor] of saved) {
    if (descriptor === undefined) {
      delete globalThis[name];
    } else {
      Object.defineProperty(globalThis, name, descriptor);
    }
  }
  saved.clear();
}

/**
 * Delete every window global, including ones another package's tests
 * installed before `installDom()` (Bun runs all files in one process, and
 * the ui-react tests keep their own jsdom globals). `installDom()` puts the
 * shared window back.
 */
export function hideDom() {
  removeDom();
  for (const name of GLOBALS) {
    if (!saved.has(name)) {
      saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    }
    delete globalThis[name];
  }
}

installDom();

/** `vue`, loaded after the globals. */
export const Vue = await import('vue');
/** `@vue/test-utils`, loaded after the globals. */
export const TestUtils = await import('@vue/test-utils');
/** `@link-foundation/ui-vue`, loaded after the globals. */
export const UiVue = await import('@link-foundation/ui-vue');

/**
 * Install the globals for the tests of the calling file, empty the body
 * after each test and remove the globals after the last one.
 */
export function useDom() {
  beforeAll(installDom);
  afterEach(() => {
    window.document.body.replaceChildren();
  });
  afterAll(removeDom);
}

/** A fresh `<div>` in the body to mount into. */
export function container() {
  const element = window.document.createElement('div');
  window.document.body.appendChild(element);
  return element;
}

/**
 * A store of the text whose `listenerCount()` tells how many `subscribe`
 * listeners are active (ui-store does not expose it).
 */
export function countedStore(text) {
  const store = createStore({ text });
  const active = new Set();
  return Object.create(store, {
    subscribe: {
      value(listener) {
        const token = {};
        active.add(token);
        const unsubscribe = store.subscribe(listener);
        return () => active.delete(token) && unsubscribe();
      },
    },
    listenerCount: { value: () => active.size },
  });
}

/** Wait for queued microtasks and Vue's scheduler. */
export const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Every `ui-*` element in the body. */
export const uiNodes = () =>
  [...window.document.body.querySelectorAll('*')].filter((node) =>
    node.localName.startsWith('ui-')
  );
