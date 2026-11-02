/**
 * `compileCss`: the stylesheet of the DOM renderer, compared with golden
 * files and checked by a real CSS parser (postcss, a test-only dependency).
 */

import { describe, it, expect } from 'test-anywhere';
import postcss from 'postcss';
import {
  compileCss,
  escapeIdentifier,
  quoteString,
  readStyles,
} from '@link-foundation/ui-style';
import { fixtureStyles, golden, sampleStyles } from './helpers.js';

/** Every rule of a stylesheet as `[selector, [prop: value...]]`, with its at-rules. */
function outline(css) {
  const out = [];
  postcss.parse(css).walkRules((rule) => {
    const at = [];
    for (let p = rule.parent; p && p.type === 'atrule'; p = p.parent) {
      at.unshift(`@${p.name} ${p.params}`);
    }
    const decls = rule.nodes.map((d) => `${d.prop}: ${d.value}`);
    out.push([...at, rule.selector, decls]);
  });
  return out;
}

describe('compileCss: the issue-1 sample', () => {
  const css = compileCss(sampleStyles().rules);

  it('equals tests/golden/styles.css', () => {
    expect(css).toBe(golden('styles.css', css));
  });

  it('is parsed by postcss into the rules of the issue', () => {
    expect(outline(css)).toEqual([
      [
        "ui-button[variant='filled']",
        [
          'background-color: var(--color-primary)',
          'color: var(--color-on-primary)',
          'border-radius: var(--shape-corner-medium)',
        ],
      ],
      ["ui-button[variant='filled']:hover", ['box-shadow: var(--elevation-2)']],
      ["ui-button[variant='filled']:active", ['transform: scale(0.98)']],
    ]);
  });
});

describe('compileCss: conditions, states and values', () => {
  const css = compileCss(fixtureStyles('card.lino').rules);

  it('equals tests/golden/card.css', () => {
    expect(css).toBe(golden('card.css', css));
  });

  it('is parsed by postcss with at-rules around their rules', () => {
    const card = 'ui-dialog ui-card';
    const chip = "ui-list ui-chip#chip\\ 1[label='it\\'s']:is(ui-dialog *)";
    expect(outline(css)).toEqual([
      [card, ['padding: var(--space-medium)']],
      ['@media (max-width: 640px)', card, ['padding: var(--space-small)']],
      ['@media (max-width: 640px)', `${card}:hover`, ['opacity: 0.92']],
      ['@container (min-width: 400px)', card, ['flex-direction: row']],
      [
        '@media (prefers-color-scheme: dark) and (prefers-reduced-motion: reduce)',
        card,
        ['border-color: var(--color-outline)'],
      ],
      [
        `${card}:is(:disabled, [disabled], [aria-disabled='true'])`,
        ['opacity: 0.38'],
      ],
      [
        chip,
        [
          'border-radius: 8px 8px 0 0',
          'gap: 4px 0.5rem',
          'font-size: 14px',
          'font-weight: 500',
          'border-width: 1px',
        ],
      ],
      [
        `${chip}[aria-selected='true']`,
        ['background-color: var(--color-selected, #E8DEF8)'],
      ],
      [`${chip}[aria-checked='true']`, ['color: oklch(0.5 0.1 300)']],
      [
        `${chip}:focus-visible`,
        ['transform: scale(var(--motion-scale-focus))'],
      ],
    ]);
  });

  it('escapes identifiers and quotes property values', () => {
    expect(css).toContain(
      "ui-list ui-chip#chip\\ 1[label='it\\'s']:is(ui-dialog *)[aria-selected='true']"
    );
    expect(css).toContain('background-color: var(--color-selected, #E8DEF8);');
    expect(css).toContain('color: oklch(0.5 0.1 300);');
    expect(css).toContain('transform: scale(var(--motion-scale-focus));');
  });
});

describe('compileCss: options and safety', () => {
  const { rules } = readStyles(`(r: style
  (selector (type button))
  (background (token color.primary))
  (opacity 0.1)
  (opacity 0.2))`);

  it('writes the token prefix of ui-tokens', () => {
    expect(compileCss(rules, { prefix: 'md' })).toContain(
      'background-color: var(--md-color-primary);'
    );
  });

  it('uses tagFor for element kinds', () => {
    expect(
      compileCss(rules, { tagFor: (kind) => `[data-kind='${kind}']` })
    ).toContain("[data-kind='button'] {");
  });

  it('keeps only the last declaration of a property', () => {
    const css = compileCss(rules);
    expect(css).toContain('opacity: 0.2;');
    expect(css).not.toContain('opacity: 0.1;');
  });

  it('writes no rule for an empty block and nothing for no rules', () => {
    const { rules: empty } = readStyles(
      '(r: style (selector (type x)) (state hover))'
    );
    expect(compileCss(empty)).toBe('');
    expect(compileCss([])).toBe('');
  });

  it('never writes url( nor free text from the source', () => {
    const { rules: hostile, diagnostics } = readStyles(`(r: style
  (selector (type x))
  (background 'url(http://evil)')
  (border-color 'url(evil)')
  (padding 'calc(1px);}body{x')
  (color 'red;}body{color:red'))`);
    expect(diagnostics.map((d) => d.code)).toEqual([
      'css-syntax',
      'invalid-value',
      'invalid-value',
      'css-syntax',
    ]);
    expect(hostile[0].declarations).toEqual([]);
    const css = compileCss(hostile);
    expect(css).not.toContain('url(');
    expect(css).toBe('');
  });

  it('escapes as CSS.escape', () => {
    expect(escapeIdentifier('ok')).toBe('ok');
    expect(escapeIdentifier('1a')).toBe('\\31 a');
    expect(escapeIdentifier('-1')).toBe('-\\31 ');
    expect(escapeIdentifier('-')).toBe('\\-');
    expect(escapeIdentifier('a b.c')).toBe('a\\ b\\.c');
    expect(escapeIdentifier('é_x')).toBe('é_x');
    expect(escapeIdentifier('a\nb')).toBe('a\\a b');
    expect(quoteString("it's \\ ok")).toBe("'it\\'s \\\\ ok'");
    expect(quoteString('a\nb')).toBe("'a\\a b'");
    expect(escapeIdentifier('a\0b')).toBe('a\uFFFDb');
    expect(quoteString('\0')).toBe("'\uFFFD'");
  });

  it('parses selectors with escapes back to the same text', () => {
    const { rules: odd } = readStyles(`(r: style
  (selector (type 'x{}') (id '"}*{') (data-v ']'))
  (opacity 1))`);
    const css = compileCss(odd);
    const [[selector, decls]] = outline(css);
    expect(selector).toBe(`ui-x\\{\\}#\\"\\}\\*\\{[data-v=']']`);
    expect(decls).toEqual(['opacity: 1']);
  });
});
