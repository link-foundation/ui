/**
 * Live announcements: one visually hidden region with a polite (status)
 * and an assertive (alert) child.
 */

import { describe, it, expect } from 'test-anywhere';
import {
  announce,
  clearAnnouncements,
  liveRegion,
} from '@link-foundation/ui-components/a11y';
import { createDom } from '../support/dom.js';

describe('announce', () => {
  it('creates one live region with polite and assertive children', () => {
    const { document } = createDom();
    const region = liveRegion(document);
    expect(liveRegion(document)).toBe(region);
    expect(region.id).toBe('ui-live-region');
    expect(region.getAttribute('style')).toContain('clip');
    expect(
      [...region.children].map((c) => [
        c.getAttribute('role'),
        c.getAttribute('aria-live'),
      ])
    ).toEqual([
      ['status', 'polite'],
      ['alert', 'assertive'],
    ]);
  });

  it('puts the message in the region of its politeness', () => {
    const { document } = createDom();
    announce('Saved', { document });
    announce('Connection lost', { document, politeness: 'assertive' });
    const region = liveRegion(document);
    expect(region.querySelector('[aria-live="polite"]').textContent).toBe(
      'Saved'
    );
    expect(region.querySelector('[aria-live="assertive"]').textContent).toBe(
      'Connection lost'
    );
    announce('Saved again', { document });
    expect(region.querySelector('[aria-live="polite"]').textContent).toBe(
      'Saved again'
    );
  });

  it('sets text, never markup', () => {
    const { document } = createDom();
    const node = announce('<img src=x onerror=alert(1)>', { document });
    expect(node.children.length).toBe(0);
    expect(document.querySelector('img')).toBeNull();
  });

  it('clears announcements and rejects an unknown politeness', () => {
    const { document } = createDom();
    announce('Saved', { document });
    clearAnnouncements(document);
    expect(liveRegion(document).textContent).toBe('');
    expect(() => announce('x', { document, politeness: 'loud' })).toThrow();
  });
});
