/**
 * link: an `<a>` to a URL or an element; a click goes through the
 * `navigate` action, which rejects `javascript:` URLs.
 */

import { describe, it, expect } from 'test-anywhere';
import { attrs, mountDoc } from '../support/controls.js';

describe('link', () => {
  it('opens an external URL in a new tab without the opener', () => {
    const t = mountDoc(
      `  (docs: link 'Docs' (href 'https://example.com/docs') (external true))`
    );
    expect(t.codes()).toEqual([]);
    const a = t.part('docs', 'root');
    expect(a.tagName).toBe('A');
    expect(a.textContent).toBe('Docs');
    expect(attrs(a, ['href', 'target', 'rel'])).toEqual({
      href: 'https://example.com/docs',
      target: '_blank',
      rel: 'noopener noreferrer',
    });
  });

  it('sends a click to the host navigate action', () => {
    const visited = [];
    const t = mountDoc(`  (docs: link 'Docs' (href '/docs'))`, {
      host: { navigate: (target) => visited.push(target) },
    });
    const a = t.part('docs', 'root');
    const click = new t.window.MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });
    a.dispatchEvent(click);
    expect(visited).toEqual(['/docs']);
    expect(click.defaultPrevented).toBe(true);
  });

  it('rejects a javascript: URL', () => {
    const visited = [];
    const t = mountDoc(`  (bad: link 'Bad' (href 'javascript:alert(1)'))`, {
      host: { navigate: (target) => visited.push(target) },
    });
    expect(t.codes()).toContain('unsafe-url@bad:href');
    const a = t.part('bad', 'root');
    expect(a.hasAttribute('href')).toBe(false);
    expect(attrs(a, ['role', 'aria-disabled'])).toEqual({
      role: 'link',
      'aria-disabled': 'true',
    });
    const click = new t.window.MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });
    a.dispatchEvent(click);
    expect(visited).toEqual([]);
    expect(click.defaultPrevented).toBe(true);
  });
});
