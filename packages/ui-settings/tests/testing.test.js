import { describe, it, expect } from 'test-anywhere';

import { assertEverySettingUsed } from '../src/index.js';
import { demoSchema } from './helpers.js';

const schema = demoSchema();
const css = `
:root { backdrop-filter: blur(var(--liquid-blur)); color: var(--accent); }
[data-theme-mode='dark'] { color-scheme: dark; }`;
const sources = ["if (settings['motion.reduce']) stopAnimations();"];

describe('assertEverySettingUsed', () => {
  it('passes when every setting is read', () => {
    expect(() =>
      assertEverySettingUsed(schema, { css, sources })
    ).not.toThrow();
  });

  it('fails when a CSS variable is never read', () => {
    let error;
    try {
      assertEverySettingUsed(schema, {
        css: css.replace('var(--liquid-blur)', 'var(--liquid-blur-2)'),
        sources,
      });
    } catch (caught) {
      error = caught;
    }
    expect(error.unused).toEqual(['liquid.blur']);
    expect(error.message).toMatch(/--liquid-blur is never read/);
  });

  it('fails when a data attribute or a key is never read', () => {
    let error;
    try {
      assertEverySettingUsed(schema, {
        css: css.replace('data-theme-mode', 'data-theme'),
        sources: ["settings['motion.reduce.x']"],
      });
    } catch (caught) {
      error = caught;
    }
    expect(error.unused).toEqual(['theme.mode', 'motion.reduce']);
  });
});
