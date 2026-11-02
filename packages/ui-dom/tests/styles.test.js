/**
 * Styles: one sheet of base rules, token custom properties and compiled
 * style rules, adopted once per root node (or one `<style>` element).
 */

import { describe, it, expect } from 'test-anywhere';
import { buildCss, mountDocument, render } from '@link-foundation/ui-dom';
import { createStore } from '@link-foundation/ui-store';
import { readTokens, resolveTokens } from '@link-foundation/ui-tokens';
import { createDom, sample } from './setup-dom.js';

const STYLED = () => ({ tokens: sample('tokens'), styles: sample('styles') });

const sheetText = (sheet) =>
  [...sheet.cssRules].map((rule) => rule.cssText).join('\n');

describe('styles', () => {
  it('builds the sheet from the base rules, tokens and style rules', () => {
    const css = buildCss(STYLED(), 'material3', () => {});
    expect(css).toContain(':where(ui-stack)');
    expect(css).toContain('--color-primary: #6750a4;');
    expect(css).toContain(
      "ui-button[variant='filled'] {\n  background-color: var(--color-primary);"
    );
    expect(css.indexOf('--color-primary')).toBeLessThan(
      css.indexOf("ui-button[variant='filled']")
    );
  });

  it('adopts one constructed sheet per root, shared by renders', () => {
    const { document, container } = createDom({ adopt: true });
    const second = document.createElement('div');
    document.body.appendChild(second);
    const a = mountDocument(container, sample('document'), STYLED());
    const b = mountDocument(second, sample('document'), STYLED());
    expect(document.adoptedStyleSheets.length).toBe(1);
    expect(document.querySelectorAll('style').length).toBe(0);
    const text = sheetText(document.adoptedStyleSheets[0]);
    expect(text).toContain('--color-primary: #6750a4');
    expect(text).toContain('background-color: var(--color-primary)');
    expect(a.handle.styles.sheet).toBe(document.adoptedStyleSheets[0]);
    a.handle.destroy();
    expect(document.adoptedStyleSheets.length).toBe(1);
    b.handle.destroy();
    expect(document.adoptedStyleSheets.length).toBe(0);
  });

  it('keeps sheets the page adopted itself', () => {
    const { window, document, container } = createDom({ adopt: true });
    const own = new window.CSSStyleSheet();
    document.adoptedStyleSheets = [own];
    const { handle } = mountDocument(container, sample('document'), STYLED());
    expect(document.adoptedStyleSheets.length).toBe(2);
    expect(document.adoptedStyleSheets[0]).toBe(own);
    handle.destroy();
    expect(document.adoptedStyleSheets).toEqual([own]);
  });

  it('falls back to one <style> element without adoptedStyleSheets', () => {
    const { window, document, container } = createDom();
    const second = document.createElement('div');
    document.body.appendChild(second);
    const a = mountDocument(container, sample('document'), STYLED());
    const b = mountDocument(second, sample('document'), STYLED());
    const styles = document.head.querySelectorAll('style[data-ui-dom]');
    expect(styles.length).toBe(1);
    // The cascade reaches the light-DOM custom element.
    const ok = a.handle.nodeFor('ok');
    expect(window.getComputedStyle(ok).backgroundColor).toBe(
      'var(--color-primary)'
    );
    a.handle.destroy();
    b.handle.destroy();
    expect(document.querySelectorAll('style').length).toBe(0);
  });

  it('adopts the sheet on a shadow root container', () => {
    const { document } = createDom({ adopt: true });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [];
    const container = document.createElement('div');
    shadow.appendChild(container);
    const { handle } = mountDocument(container, sample('document'), STYLED());
    expect(shadow.adoptedStyleSheets.length).toBe(1);
    expect(document.adoptedStyleSheets.length).toBe(0);
    expect(sheetText(shadow.adoptedStyleSheets[0])).toContain(':host');
    handle.destroy();
    expect(shadow.adoptedStyleSheets.length).toBe(0);
  });

  it("uses the document's theme, the theme option, or the first set", () => {
    const tokens = `(light: theme (token color.primary '#111111'))
(dark: theme (token color.primary '#eeeeee'))`;
    const themed = buildCss({ tokens }, 'dark', () => {});
    expect(themed).toContain('--color-primary: #eeeeee;');
    const chosen = buildCss({ tokens, theme: 'light' }, 'dark', () => {});
    expect(chosen).toContain('--color-primary: #111111;');
    const first = buildCss({ tokens }, 'missing', () => {});
    expect(first).toContain('--color-primary: #111111;');
    const resolved = resolveTokens(readTokens(tokens).sets, 'dark');
    expect(buildCss({ tokens: resolved }, undefined, () => {})).toContain(
      '--color-primary: #eeeeee;'
    );
  });

  it('applies the css option and can leave out the base rules', () => {
    const css = buildCss({ css: 'ui-text { color: red; }', baseCss: false });
    expect(css).toBe('ui-text { color: red; }');
  });

  it('reports token and style diagnostics', () => {
    const { container } = createDom();
    const codes = [];
    render(container, createStore({ text: sample('document') }), {
      ...STYLED(),
      styles: '(s: style (selector (type button)) (background 12px))',
      onDiagnostic: (d) => codes.push(d.code),
    });
    expect(codes).toContain('unknown-set');
    expect(codes).toContain('invalid-value');
  });

  it('applies no stylesheet with adoptStyles: false', () => {
    const { document, container } = createDom({ adopt: true });
    const { handle } = mountDocument(container, sample('document'), {
      ...STYLED(),
      adoptStyles: false,
    });
    expect(handle.styles).toBeNull();
    expect(document.adoptedStyleSheets.length).toBe(0);
  });
});
