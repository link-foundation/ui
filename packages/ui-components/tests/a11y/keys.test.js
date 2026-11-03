/**
 * Keyboard bindings: key names, and bindKeys ignoring plain keys typed in
 * text fields.
 */

import { describe, it, expect } from 'test-anywhere';
import {
  bindKeys,
  firesInField,
  isTextField,
  keyOf,
  normalizeKey,
} from '@link-foundation/ui-components/a11y';
import { createDom, press } from '../support/dom.js';

describe('key names', () => {
  it('names keys with modifiers in a fixed order', () => {
    expect(keyOf({ key: ' ' })).toBe('Space');
    expect(keyOf({ key: 'Enter' })).toBe('Enter');
    expect(keyOf({ key: 's', ctrlKey: true })).toBe('Ctrl+s');
    // Shift is in the character itself: Shift+a is 'A'.
    expect(keyOf({ key: 'A', shiftKey: true })).toBe('A');
    expect(keyOf({ key: 'Tab', shiftKey: true })).toBe('Shift+Tab');
    expect(keyOf({ key: 'k', metaKey: true, altKey: true })).toBe('Alt+Meta+k');
  });

  it('normalises written combinations', () => {
    expect(normalizeKey('shift+ctrl+S')).toBe('Ctrl+S');
    expect(normalizeKey('control+shift+Tab')).toBe('Ctrl+Shift+Tab');
    expect(normalizeKey('esc')).toBe('Escape');
    expect(normalizeKey('space')).toBe('Space');
    expect(normalizeKey('Escape')).toBe('Escape');
  });

  it('knows which combinations fire in text fields', () => {
    expect(firesInField('a')).toBe(false);
    expect(firesInField('Space')).toBe(false);
    expect(firesInField('Ctrl+s')).toBe(true);
    expect(firesInField('Escape')).toBe(true);
  });
});

describe('bindKeys', () => {
  const page = () =>
    createDom(`<div id="app">
  <button id="b">B</button>
  <input id="field">
  <textarea id="area"></textarea>
  <div id="editor" contenteditable="true"></div>
</div>`);

  it('runs the binding of a key and prevents its default', () => {
    const { document } = page();
    const calls = [];
    bindKeys(document.getElementById('app'), {
      a: () => calls.push('a'),
      'Ctrl+s': () => calls.push('save'),
    });
    const down = press(document.getElementById('b'), 'a');
    press(document.getElementById('b'), 's', { ctrlKey: true });
    expect(calls).toEqual(['a', 'save']);
    expect(down.defaultPrevented).toBe(true);
  });

  it('a plain letter key in an input does not trigger a binding', () => {
    const { document } = page();
    const calls = [];
    bindKeys(document.getElementById('app'), {
      a: () => calls.push('a'),
      Space: () => calls.push('space'),
    });
    for (const id of ['field', 'area', 'editor']) {
      const down = press(document.getElementById(id), 'a');
      press(document.getElementById(id), ' ');
      expect(down.defaultPrevented).toBe(false);
    }
    expect(calls).toEqual([]);
    expect(isTextField(document.getElementById('field'))).toBe(true);
    expect(isTextField(document.getElementById('b'))).toBe(false);
  });

  it('modifier combinations and Escape still fire in an input', () => {
    const { document } = page();
    const calls = [];
    bindKeys(document.getElementById('app'), {
      'Ctrl+s': () => calls.push('save'),
      Escape: () => calls.push('escape'),
    });
    const field = document.getElementById('field');
    press(field, 's', { ctrlKey: true });
    press(field, 'Escape');
    expect(calls).toEqual(['save', 'escape']);
  });

  it('ignoreInFields: false binds plain keys in fields too', () => {
    const { document } = page();
    const calls = [];
    bindKeys(
      document.getElementById('app'),
      { a: () => calls.push('a') },
      { ignoreInFields: false }
    );
    press(document.getElementById('field'), 'a');
    expect(calls).toEqual(['a']);
  });

  it('a binding returning false keeps the default; unbind removes it', () => {
    const { document } = page();
    const calls = [];
    const unbind = bindKeys(document.getElementById('app'), {
      Enter: () => {
        calls.push('enter');
        return false;
      },
    });
    const down = press(document.getElementById('b'), 'Enter');
    expect(down.defaultPrevented).toBe(false);
    unbind();
    press(document.getElementById('b'), 'Enter');
    expect(calls).toEqual(['enter']);
  });
});
