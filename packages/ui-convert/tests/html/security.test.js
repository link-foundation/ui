/**
 * Security: scripts, event handlers and script URLs never reach the output.
 */

import { describe, it, expect } from 'test-anywhere';
import {
  hasScriptUrl,
  importDom,
  importHtml,
  isEventAttribute,
} from '@link-foundation/ui-convert';
import { domFragment, fixtures } from './helpers.js';

const unsafe = fixtures().find((f) => f.name === 'unsafe').html;

describe('security', () => {
  it('unsafe.html output has no script, onclick or javascript: text', () => {
    for (const { text } of [
      importHtml(unsafe),
      importDom(domFragment(unsafe)),
    ]) {
      const lower = text.toLowerCase();
      for (const banned of [
        'script',
        'onclick',
        'onload',
        'onmouseover',
        'javascript:',
        'iframe',
        'object',
        'embed',
        'steal',
        'alert',
      ]) {
        expect(lower.includes(banned)).toBe(false);
      }
    }
  });

  it('reports one dropped-script diagnostic per dropped item', () => {
    const { diagnostics } = importHtml(unsafe);
    expect(diagnostics.map(({ code, id }) => ({ code, id }))).toEqual([
      { code: 'dropped-script', id: 'div-0' }, // onload
      { code: 'dropped-script', id: 'script-0-0' },
      { code: 'dropped-script', id: 'a-0-1' }, // href="javascript:..."
      { code: 'dropped-script', id: 'a-0-2' }, // href=" JaVaScRiPt:..."
      { code: 'dropped-script', id: 'button-0-3' }, // onclick
      { code: 'dropped-script', id: 'button-0-3' }, // ONMOUSEOVER
      { code: 'dropped-script', id: 'iframe-0-4' },
      { code: 'dropped-script', id: 'object-0-5' },
      { code: 'dropped-script', id: 'embed-0-6' },
      { code: 'dropped-script', id: 'script-1' },
    ]);
    for (const diagnostic of diagnostics) {
      expect(typeof diagnostic.message).toBe('string');
      expect(diagnostic.message.includes(diagnostic.id)).toBe(true);
    }
  });

  it('keeps the safe content around the dropped items', () => {
    const { text } = importHtml(unsafe);
    expect(text.includes("(alt 'Safe image')")).toBe(true);
    expect(text.includes("(p-0-8: text 'Safe text'")).toBe(true);
    expect(text.includes('(attr title Home)')).toBe(true);
  });

  it('drops script URLs in any attribute', () => {
    const { text, diagnostics } = importHtml(
      '<form action="javascript:go()"><img src="x.png" data-x="vbscript:msgbox"></form>'
    );
    expect(text.toLowerCase().includes('script')).toBe(false);
    expect(diagnostics.length).toBe(2);
  });

  it('recognises event handlers and script URLs', () => {
    expect(isEventAttribute('onclick')).toBe(true);
    expect(isEventAttribute('OnLoad')).toBe(true);
    expect(isEventAttribute('class')).toBe(false);
    expect(hasScriptUrl('java\tscript:alert(1)')).toBe(true);
    expect(hasScriptUrl('  JAVASCRIPT:x')).toBe(true);
    expect(hasScriptUrl('https://example.com/javascript')).toBe(false);
  });
});
