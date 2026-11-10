import { describe, it, expect } from 'test-anywhere';
import { createSimpleIconsSource } from '../../src/icons/adapters/simple-icons.js';
import { registerIconSet, resolveIcon } from '../../src/icons/index.js';
import { defineIconElement, iconVocabulary } from '../../src/icons/icon.js';
import { mountDocument } from '@link-foundation/ui-dom';
import { createDom } from './helpers.js';

describe('Simple Icons brand set', () => {
  it('resolves GitHub as a filled 24px currentColor mark with CC0 and trademark records', async () => {
    const source = createSimpleIconsSource({ names: { github: 'github' } });
    const icon = await source.resolve('github');
    expect(icon.viewBox).toBe('0 0 24 24');
    expect(icon.title).toBe('GitHub');
    expect(icon.body).toContain('currentColor');
    expect(icon.record.license).toBe('CC0-1.0');
    expect(icon.record.attributionText).toContain('trademark');
    expect(source.records()).toEqual([icon.record]);
  });

  it('diagnoses withdrawn names and a missing optional package and renders a placeholder', async () => {
    for (const options of [
      {},
      {
        load: async () => {
          throw new Error('package unavailable');
        },
      },
    ]) {
      const diagnostics = [];
      const source = createSimpleIconsSource({
        ...options,
        onDiagnostic: (d) => diagnostics.push(d),
      });
      const stop = registerIconSet('brand', source);
      try {
        const name = options.load ? 'github' : 'linkedin';
        const icon = await resolveIcon(`brand:${name}`);
        expect(icon.placeholder).toBe(true);
        expect(icon.body.length > 0).toBe(true);
        expect(
          diagnostics.some((d) => d.name === name && d.set === 'brand')
        ).toBe(true);
      } finally {
        stop();
      }
    }
  });

  it('uses the title only with label=true, including LiNo rendering', async () => {
    const stop = registerIconSet('brand', createSimpleIconsSource());
    const dom = createDom();
    defineIconElement(dom.window);
    try {
      const result = mountDocument(
        dom.container,
        `app: document
  icon
    set brand
    name github
    label true
  icon
    set brand
    name github`,
        { parseOptions: { vocabulary: iconVocabulary() } }
      );
      expect(result.diagnostics).toEqual([]);
      const [named, decorative] = dom.container.querySelectorAll('ui-icon');
      await Promise.all([named.ready, decorative.ready]);
      expect(named.getAttribute('aria-label')).toBe('GitHub');
      expect(named.getAttribute('role')).toBe('img');
      expect(decorative.getAttribute('aria-hidden')).toBe('true');
      named.setAttribute('label', 'false');
      expect(named.getAttribute('aria-hidden')).toBe('true');
    } finally {
      stop();
      dom.window.close();
    }
  });
});
