/**
 * `toCss(resolved, options)`: CSS custom properties.
 */

import { describe, it, expect } from 'test-anywhere';
import { cssVariable, toCss } from '@link-foundation/ui-tokens';
import { full, golden, resolveText, sample } from './helpers.js';

describe('toCss: the issue-1 sample', () => {
  it('gives exactly the CSS of the issue', () => {
    expect(toCss(sample())).toBe(`:root {
  --color-primary: #6750a4;
  --color-on-primary: #ffffff;
  --space-medium: 16px;
  --shape-corner-medium: 12px;
  --motion-duration-short: 150ms;
}
`);
  });

  it('equals the golden file', () => {
    const css = toCss(sample());
    expect(css).toBe(golden('material3.css', css));
  });
});

describe('toCss: every type and the options', () => {
  it('equals the golden file of the full fixture with a media query for dark', () => {
    const css = toCss(full(), {
      modeMedia: { dark: '(prefers-color-scheme: dark)' },
    });
    expect(css).toBe(golden('full/brand.css', css));
  });

  it('writes the modes with a selector by default', () => {
    const css = toCss(full());
    expect(css).toContain(
      '\n\n[data-mode="dark"] {\n  --color-primary: #d0bcff;\n'
    );
  });

  it('applies the prefix, the selector and the mode selector to names and aliases', () => {
    const resolved = resolveText(
      '(t: theme (token a.b 1px) (token c (token a.b)) (mode dark (token a.b 2px)))',
      't'
    );
    expect(
      toCss(resolved, {
        prefix: 'ui',
        selector: '.app',
        modeSelector: (mode) => `.app.${mode}`,
      })
    ).toBe(`.app {
  --ui-a-b: 1px;
  --ui-c: var(--ui-a-b);
}

.app.dark {
  --ui-a-b: 2px;
  --ui-c: var(--ui-a-b);
}
`);
  });

  it('writes resolved values for one mode', () => {
    const resolved = resolveText(
      '(t: theme (token a 1px) (mode dark (token a 2px)))',
      't',
      { mode: 'dark' }
    );
    expect(toCss(resolved)).toBe(':root {\n  --a: 2px;\n}\n');
  });

  it('names variables after the path', () => {
    expect(cssVariable('color.on-primary')).toBe('--color-on-primary');
    expect(cssVariable('space.2xl', 'md')).toBe('--md-space-2xl');
  });
});

describe('quoted system font stacks', () => {
  it('exports the comma-separated stack as individual system families', () => {
    const tokens = resolveText(
      "system: theme\n  token font.family.text 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif'",
      'system'
    );
    expect(toCss(tokens)).toContain(
      '--font-family-text: system-ui, "-apple-system", "BlinkMacSystemFont", sans-serif;'
    );
  });
});
