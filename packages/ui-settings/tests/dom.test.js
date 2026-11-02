import { createHash } from 'node:crypto';
import { describe, it, expect } from 'test-anywhere';
import { JSDOM } from 'jsdom';

import {
  applyToRoot,
  beforePaintScript,
  beforePaintScriptHash,
  PAINT_STORAGE_KEY,
  paintSnapshot,
} from '../src/index.js';
import { demoSchema } from './helpers.js';

const schema = demoSchema();

/** Run the before-paint script in a fresh jsdom page with stored text. */
function runScript(stored, options) {
  const dom = new JSDOM('<!doctype html><html><head></head></html>', {
    url: 'https://example.test/',
    runScripts: 'outside-only',
  });
  if (stored !== undefined) {
    dom.window.localStorage.setItem(
      options?.storageKey ?? PAINT_STORAGE_KEY,
      stored
    );
  }
  dom.window.eval(beforePaintScript(schema, options));
  return dom.window.document.documentElement;
}

describe('applyToRoot', () => {
  it('sets CSS variables and data attributes', () => {
    const { window } = new JSDOM('<!doctype html><html></html>');
    const root = window.document.documentElement;
    applyToRoot(schema, { 'liquid.blur': 24, 'theme.mode': 'dark' }, root);
    expect(root.style.getPropertyValue('--liquid-blur')).toBe('24px');
    expect(root.style.getPropertyValue('--accent')).toBe('#3390EC');
    expect(root.getAttribute('data-theme-mode')).toBe('dark');
  });

  it('applies defaults for invalid values', () => {
    const { window } = new JSDOM('<!doctype html><html></html>');
    const root = window.document.documentElement;
    applyToRoot(schema, { 'theme.mode': 'sepia', accent: 'red' }, root);
    expect(root.getAttribute('data-theme-mode')).toBe('auto');
    expect(root.style.getPropertyValue('--accent')).toBe('#3390EC');
  });
});

describe('beforePaintScript', () => {
  it('applies the stored snapshot', () => {
    const snapshot = paintSnapshot(schema, {
      'liquid.blur': 30,
      'theme.mode': 'light',
      'motion.reduce': true,
    });
    expect(snapshot).toBe('{"liquid.blur":30,"theme.mode":"light"}');
    const root = runScript(snapshot);
    expect(root.style.getPropertyValue('--liquid-blur')).toBe('30px');
    expect(root.getAttribute('data-theme-mode')).toBe('light');
    expect(root.style.getPropertyValue('--accent')).toBe('#3390EC');
  });

  it('applies defaults when storage is corrupted', () => {
    for (const stored of ['{not json', '[1,2]', 'null', undefined]) {
      const root = runScript(stored);
      expect(root.style.getPropertyValue('--liquid-blur')).toBe('18px');
      expect(root.getAttribute('data-theme-mode')).toBe('auto');
    }
  });

  it('checks every stored value against the schema', () => {
    const root = runScript(
      JSON.stringify({
        'liquid.blur': 99,
        'theme.mode': 'sepia',
        accent: 'red;background:url(x)',
      })
    );
    expect(root.style.getPropertyValue('--liquid-blur')).toBe('40px');
    expect(root.getAttribute('data-theme-mode')).toBe('auto');
    expect(root.style.getPropertyValue('--accent')).toBe('#3390EC');
  });

  it('does not throw without storage', () => {
    const dom = new JSDOM('<!doctype html><html></html>', {
      runScripts: 'outside-only',
    });
    // An opaque origin: reading localStorage throws.
    expect(() => dom.window.eval(beforePaintScript(schema))).not.toThrow();
    const root = dom.window.document.documentElement;
    expect(root.getAttribute('data-theme-mode')).toBe('auto');
  });

  it('uses the storage key given and is safe inline', () => {
    const root = runScript('{"liquid.blur":2}', { storageKey: 'my-key' });
    expect(root.style.getPropertyValue('--liquid-blur')).toBe('2px');
    expect(
      beforePaintScript(schema, { storageKey: '</script>' }).includes(
        '</script>'
      )
    ).toBe(false);
  });

  it('has the CSP hash of the script', async () => {
    const script = beforePaintScript(schema);
    const expected = `sha256-${createHash('sha256').update(script).digest('base64')}`;
    expect(await beforePaintScriptHash(schema)).toBe(expected);
    expect(await beforePaintScriptHash(script)).toBe(expected);
  });
});
