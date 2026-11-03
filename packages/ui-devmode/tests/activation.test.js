/**
 * The entry points: the shortcut (on `event.code`, never in a field where
 * the user types), the `?ui-dev` URL parameter and `<ui-dev-mode>`.
 */

import { describe, it, expect } from 'test-anywhere';
import {
  ELEMENT_NAME,
  installActivation,
  isEditableTarget,
  matchesShortcut,
  parseDevModePolicy,
  parseShortcut,
  shouldActivate,
} from '../src/index.js';
import { createDom, key, POLICY, shortcut } from './setup.js';

const policy = parseDevModePolicy(POLICY);
const disabled = parseDevModePolicy('(p: dev-mode (enabled false))');

/** Install the entry points of a window and record every call. */
function install(window, withPolicy = policy) {
  const calls = [];
  const uninstall = installActivation({
    window,
    policy: withPolicy,
    onActivate: (entry) => calls.push(`activate:${entry}`),
    onToggle: (entry) => calls.push(`toggle:${entry}`),
  });
  return { calls, uninstall };
}

describe('shortcut', () => {
  it('parses Alt+Shift+D to the physical key KeyD', () => {
    expect(parseShortcut('Alt+Shift+D')).toEqual({
      altKey: true,
      shiftKey: true,
      ctrlKey: false,
      metaKey: false,
      code: 'KeyD',
    });
    expect(parseShortcut('Ctrl + Alt + 1').code).toBe('Digit1');
    expect(() => parseShortcut('Alt+Shift')).toThrow();
  });

  it('matches every modifier and the code, not the key', () => {
    const s = parseShortcut('Alt+Shift+D');
    // macOS gives `Î` as the key of Alt+Shift+D.
    expect(
      matchesShortcut(
        { code: 'KeyD', key: 'Î', altKey: true, shiftKey: true },
        s
      )
    ).toBe(true);
    expect(matchesShortcut({ code: 'KeyD', altKey: true }, s)).toBe(false);
    expect(
      matchesShortcut(
        { code: 'KeyD', altKey: true, shiftKey: true, ctrlKey: true },
        s
      )
    ).toBe(false);
    expect(
      matchesShortcut({ code: 'KeyF', altKey: true, shiftKey: true }, s)
    ).toBe(false);
  });

  it('knows the fields where the user types', () => {
    const { document } = createDom({
      body: '<input id="i"><textarea id="t"></textarea><select id="s"></select><div contenteditable id="c"><b id="b">x</b></div><button id="k">k</button>',
    });
    for (const id of ['i', 't', 's', 'c', 'b']) {
      expect(isEditableTarget(document.getElementById(id))).toBe(true);
    }
    expect(isEditableTarget(document.getElementById('k'))).toBe(false);
    expect(isEditableTarget(document.body)).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });

  it('toggles on Alt+Shift+D and does nothing in a text input', () => {
    const { window, document } = createDom({ body: '<input id="name">' });
    const { calls, uninstall } = install(window);
    window.dispatchEvent(shortcut(window));
    expect(calls).toEqual(['toggle:shortcut']);
    document.getElementById('name').dispatchEvent(shortcut(window));
    document.body.dispatchEvent(key(window, { code: 'KeyD', altKey: true }));
    expect(calls).toEqual(['toggle:shortcut']);
    uninstall();
    window.dispatchEvent(shortcut(window));
    expect(calls).toEqual(['toggle:shortcut']);
  });

  it('uses the shortcut of the policy', () => {
    const { window } = createDom();
    const custom = parseDevModePolicy(
      "(p: dev-mode (entry shortcut) (shortcut 'Ctrl+Alt+I'))"
    );
    const { calls } = install(window, custom);
    window.dispatchEvent(shortcut(window));
    window.dispatchEvent(
      key(window, { code: 'KeyI', ctrlKey: true, altKey: true })
    );
    expect(calls).toEqual(['toggle:shortcut']);
  });
});

describe('URL parameter and element', () => {
  it('activates with ?ui-dev unless it is turned off', () => {
    const at = (query) => `http://localhost/page${query}`;
    expect(shouldActivate({ url: at('?ui-dev'), policy })).toBe(true);
    expect(shouldActivate({ url: at('?a=1&ui-dev=1'), policy })).toBe(true);
    expect(shouldActivate({ url: at(''), policy })).toBe(false);
    for (const off of ['false', '0', 'off', 'no']) {
      expect(shouldActivate({ url: at(`?ui-dev=${off}`), policy })).toBe(false);
    }
    expect(shouldActivate({ url: at(''), policy, hasElement: true })).toBe(
      true
    );
  });

  it('opens on load with ?ui-dev', () => {
    const { window } = createDom({ url: 'http://localhost/?ui-dev' });
    expect(install(window).calls).toEqual(['activate:url-parameter']);
  });

  it('opens when a <ui-dev-mode> element is in the page', () => {
    const { window, document } = createDom({
      body: `<${ELEMENT_NAME}></${ELEMENT_NAME}>`,
    });
    const { calls } = install(window);
    expect(calls).toEqual(['activate:element']);
    document.body.append(document.createElement(ELEMENT_NAME));
    expect(calls).toEqual(['activate:element', 'activate:element']);
  });

  it('installs nothing for a disabled policy', () => {
    const { window, document } = createDom({
      url: 'http://localhost/?ui-dev',
      body: `<${ELEMENT_NAME}></${ELEMENT_NAME}>`,
    });
    const { calls } = install(window, disabled);
    window.dispatchEvent(shortcut(window));
    document.body.append(document.createElement(ELEMENT_NAME));
    expect(calls).toEqual([]);
    expect(window.customElements.get(ELEMENT_NAME)).toBe(undefined);
  });
});
