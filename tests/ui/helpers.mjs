/**
 * Shared helpers for Playwright UI tests (`*.e2e.mjs`). Dev/CI only: never
 * import this file (or axe-core) from a published package.
 * See docs/testing-ui.md.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';

/** WCAG 2.2 A/AA rule tags checked by default. */
export const WCAG_TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'wcag22aa',
];

export const DEFAULT_THEMES = ['light', 'dark'];
export const DEFAULT_LOCALES = ['en', 'ru'];

/**
 * Run axe-core on the page and return its violations.
 * @param {import('@playwright/test').Page} page
 * @param {{include?: string, exclude?: string[], tags?: string[]}} [opts]
 * @returns {Promise<import('axe-core').Result[]>}
 */
export async function axeViolations(page, opts = {}) {
  let builder = new AxeBuilder({ page }).withTags(opts.tags ?? WCAG_TAGS);
  if (opts.include) {
    builder = builder.include(opts.include);
  }
  for (const selector of opts.exclude ?? []) {
    builder = builder.exclude(selector);
  }
  const results = await builder.analyze();
  return results.violations;
}

/**
 * Format violations as a readable list of id, impact and target selectors.
 * @param {Pick<import('axe-core').Result, 'id' | 'impact' | 'help' | 'nodes'>[]} violations
 * @returns {string}
 */
export function formatViolations(violations) {
  return violations
    .map((violation) => {
      const targets = violation.nodes
        .map((node) => `    - ${node.target.join(' ')}`)
        .join('\n');
      return `  ${violation.id} (${violation.impact ?? 'unknown'}): ${violation.help}\n${targets}`;
    })
    .join('\n');
}

/**
 * Assert that the page has no WCAG 2.2 A/AA violations.
 *
 * `knownViolations` lists rule ids that are tracked by an open issue; they
 * are reported in the test output but do not fail the test. A listed rule
 * that no longer fires fails the test so the list never goes stale.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{include?: string, exclude?: string[], tags?: string[], knownViolations?: {id: string, issue: string}[]}} [opts]
 */
export async function expectAccessible(page, opts = {}) {
  const violations = await axeViolations(page, opts);
  const known = new Map(
    (opts.knownViolations ?? []).map((k) => [k.id, k.issue])
  );
  const unexpected = violations.filter((v) => !known.has(v.id));
  const fixed = [...known.keys()].filter(
    (id) => !violations.some((v) => v.id === id)
  );
  expect(
    unexpected,
    `Accessibility violations (WCAG 2.2 A/AA):\n${formatViolations(unexpected)}`
  ).toEqual([]);
  expect(
    fixed,
    `knownViolations no longer fire; remove them: ${fixed.map((id) => `${id} (${known.get(id)})`).join(', ')}`
  ).toEqual([]);
}

/**
 * Take one screenshot per theme × locale cell, named
 * `<name>-<locale>-<theme>.png`. `screenshot` is the options of
 * `toHaveScreenshot`, or a function of the page and the cell that returns
 * them (read after `apply`, e.g. a clip measured on the page).
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} name
 * @param {{themes?: string[], locales?: string[], apply: (page: import('@playwright/test').Page, cell: {theme: string, locale: string}) => Promise<void>, screenshot?: import('@playwright/test').PageAssertionsToHaveScreenshotOptions | ((page: import('@playwright/test').Page, cell: {theme: string, locale: string}) => Promise<import('@playwright/test').PageAssertionsToHaveScreenshotOptions>)}} opts
 */
export async function screenshotMatrix(page, name, opts) {
  for (const locale of opts.locales ?? DEFAULT_LOCALES) {
    for (const theme of opts.themes ?? DEFAULT_THEMES) {
      const cell = { theme, locale };
      await opts.apply(page, cell);
      const options =
        typeof opts.screenshot === 'function'
          ? await opts.screenshot(page, cell)
          : opts.screenshot;
      await expect(page).toHaveScreenshot(
        `${name}-${locale}-${theme}.png`,
        options
      );
    }
  }
}
