/**
 * Focus helpers: tabbables, trapFocus (Tab / Shift+Tab cycle inside the
 * container, release restores focus) and restoreFocus.
 */

import { describe, it, expect } from 'test-anywhere';
import {
  restoreFocus,
  tabbables,
  trapFocus,
} from '@link-foundation/ui-components/a11y';
import { createDom, press } from '../support/dom.js';

const BODY = `<button id="opener">Open</button>
<div id="dialog">
  <button id="first">First</button>
  <input id="field">
  <button id="skipped" disabled>Disabled</button>
  <span id="hidden" hidden><button>Hidden</button></span>
  <a id="link" href="#x">Link</a>
</div>
<button id="after">After</button>`;

const ids = (elements) => elements.map((e) => e.id);

describe('tabbables', () => {
  it('lists enabled, visible focusable elements in tab order', () => {
    const { document } = createDom(BODY);
    expect(ids(tabbables(document.getElementById('dialog')))).toEqual([
      'first',
      'field',
      'link',
    ]);
  });

  it('puts a positive tabindex first and leaves out tabindex -1', () => {
    const { document } = createDom(
      '<div id="c"><a id="a" href="#">a</a><span id="b" tabindex="2">b</span><button id="c1" tabindex="-1">c</button><span id="d" tabindex="1">d</span></div>'
    );
    expect(ids(tabbables(document.getElementById('c')))).toEqual([
      'd',
      'b',
      'a',
    ]);
  });
});

describe('trapFocus', () => {
  it('Tab and Shift+Tab cycle inside the container', () => {
    const { document } = createDom(BODY);
    const dialog = document.getElementById('dialog');
    document.getElementById('opener').focus();
    const release = trapFocus(dialog);
    const active = () => document.activeElement.id;
    expect(active()).toBe('first');
    const tab = press(document.activeElement, 'Tab');
    expect(tab.defaultPrevented).toBe(true);
    expect(active()).toBe('field');
    press(document.activeElement, 'Tab');
    expect(active()).toBe('link');
    press(document.activeElement, 'Tab');
    expect(active()).toBe('first');
    press(document.activeElement, 'Tab', { shiftKey: true });
    expect(active()).toBe('link');
    press(document.activeElement, 'Tab', { shiftKey: true });
    expect(active()).toBe('field');
    release();
  });

  it('release restores focus to the element focused before', () => {
    const { document } = createDom(BODY);
    const opener = document.getElementById('opener');
    opener.focus();
    const release = trapFocus(document.getElementById('dialog'));
    expect(document.activeElement.id).toBe('first');
    release();
    expect(document.activeElement).toBe(opener);
    // Released: Tab is no longer handled.
    const tab = press(document.getElementById('first'), 'Tab');
    expect(tab.defaultPrevented).toBe(false);
  });

  it('moves focus that leaves the container back in', () => {
    const { document } = createDom(BODY);
    const release = trapFocus(document.getElementById('dialog'), {
      initialFocus: document.getElementById('link'),
    });
    expect(document.activeElement.id).toBe('link');
    document.getElementById('after').focus();
    expect(document.activeElement.id).toBe('first');
    release();
  });

  it('focuses the container itself when it has nothing to focus', () => {
    const { document } = createDom('<div id="empty"><p>Text</p></div>');
    const empty = document.getElementById('empty');
    const release = trapFocus(empty, { restore: false });
    expect(document.activeElement).toBe(empty);
    expect(empty.getAttribute('tabindex')).toBe('-1');
    press(empty, 'Tab');
    expect(document.activeElement).toBe(empty);
    release();
  });
});

describe('restoreFocus', () => {
  it('focuses a connected element and refuses a removed one', () => {
    const { document } = createDom(BODY);
    const after = document.getElementById('after');
    expect(restoreFocus(after)).toBe(true);
    expect(document.activeElement).toBe(after);
    after.remove();
    expect(restoreFocus(after)).toBe(false);
    expect(restoreFocus(null)).toBe(false);
  });
});
