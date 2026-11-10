import { describe, it, expect } from 'test-anywhere';
import { mountDocument } from '@link-foundation/ui-dom';
import { defineIconElement, iconVocabulary } from '../../src/icons/icon.js';
import { registerIconSet } from '../../src/icons/icon-registry.js';
import { createLucideSource } from '../../src/icons/adapters/lucide.js';
import { createDom } from './helpers.js';

describe('icon presentation', () => {
  it('fills stroke icons, changes stroke width and size, and restores library defaults', async () => {
    const stop = registerIconSet('lucide', createLucideSource());
    const dom = createDom();
    defineIconElement(dom.window);
    try {
      const result = mountDocument(
        dom.container,
        `app: document
  icon
    set lucide
    name star
    fill current
    stroke-width 0.5
    size 1em`,
        { parseOptions: { vocabulary: iconVocabulary() } }
      );
      expect(result.diagnostics).toEqual([]);
      const el = dom.container.querySelector('ui-icon');
      await el.ready;
      expect(el.querySelector('path').style.fill.toLowerCase()).toBe(
        'currentcolor'
      );
      expect(el.querySelector('path').style.strokeWidth).toBe('0.5');
      expect(el.style.getPropertyValue('--ui-icon-size')).toBe('1em');
      el.removeAttribute('fill');
      el.removeAttribute('stroke-width');
      el.setAttribute('size', 'space-medium');
      await el.ready;
      expect(el.querySelector('path').style.fill).toBe('');
      expect(el.querySelector('path').style.strokeWidth).toBe('');
      expect(el.style.getPropertyValue('--ui-icon-size')).toBe(
        'var(--space-medium)'
      );
      el.setAttribute('stroke-width', '3');
      el.removeAttribute('size');
      await el.ready;
      expect(el.querySelector('path').style.strokeWidth).toBe('3');
      expect(el.style.getPropertyValue('--ui-icon-size')).toBe('');
    } finally {
      stop();
      dom.window.close();
    }
  });

  it('reports and ignores invalid values while preserving an existing CSS size', async () => {
    const dom = createDom();
    defineIconElement(dom.window);
    const el = dom.document.createElement('ui-icon');
    el.setAttribute('name', 'close');
    el.style.setProperty('--ui-icon-size', '2em');
    const diagnostics = [];
    el.addEventListener('ui-icon-diagnostic', (e) =>
      diagnostics.push(e.detail)
    );
    dom.container.append(el);
    for (const [attribute, value] of [
      ['stroke-width', '3.1'],
      ['stroke-width', 'NaN'],
      ['stroke-width', '0.4'],
      ['fill', 'red'],
      ['size', '-1em'],
      ['size', '1bogus'],
    ]) {
      el.setAttribute(attribute, value);
      await el.ready;
      expect(
        diagnostics.some((d) => d.attribute === attribute && d.value === value)
      ).toBe(true);
    }
    expect(el.querySelector('path').style.fill).toBe('');
    expect(el.style.getPropertyValue('--ui-icon-size')).toBe('2em');
    dom.window.close();
  });
});
