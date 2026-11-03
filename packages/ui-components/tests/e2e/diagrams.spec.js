/**
 * The diagrams example page (examples/diagrams.html) in a real browser:
 *
 * - our SVG renderer draws the login flow and Mermaid is not requested
 *   until a Mermaid diagram is on the page;
 * - "Show the Mermaid examples" imports Mermaid once and Mermaid draws the
 *   login flow, a sequence diagram and raw Mermaid text;
 * - when the Mermaid request is blocked, the source and an error are shown;
 * - axe finds no WCAG 2.2 A/AA violation, with and without Mermaid.
 *
 * Screenshots are attached to the report; with DIAGRAM_SCREENSHOTS set to a
 * folder they are written there too (docs/screenshots/issue-40/).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { expect, test } from '@playwright/test';

import { expectAccessible } from '../../../../tests/ui/helpers.mjs';

const PAGE = 'packages/ui-components/examples/diagrams.html';
const MERMAID = '/node_modules/mermaid/';

async function screenshot(locator, name, testInfo) {
  const body = await locator.screenshot();
  await testInfo.attach(name, { body, contentType: 'image/png' });
  const folder = process.env.DIAGRAM_SCREENSHOTS;
  if (folder && testInfo.project.name === 'chromium') {
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, `${name}.png`), body);
  }
}

/** Open the page and collect the URLs requested and the page errors. */
async function open(page, query = '') {
  const requests = [];
  const errors = [];
  page.on('request', (request) => requests.push(request.url()));
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${PAGE}${query}`);
  await expect(page.locator('body[data-ready="true"]')).toBeAttached();
  return { requests, errors };
}

const mermaidRequests = (requests) =>
  requests.filter((url) => url.includes(MERMAID));

test.describe('diagrams example', () => {
  test('draws the login flow with our renderer and never loads Mermaid', async ({
    page,
  }, testInfo) => {
    const { requests, errors } = await open(page);
    const login = page.locator('#login-svg');
    await expect(login).toHaveAttribute('data-state', 'ready');
    await expect(login).toHaveAttribute('data-renderer', 'svg');
    const svg = login.locator('svg[role="img"]');
    await expect(svg).toBeVisible();
    for (const label of ['Start', 'Signed in?', 'Home', 'yes']) {
      await expect(svg.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(login.locator('.ui-diagram-description li')).toHaveText([
      'Start',
      'Signed in?',
      'Home',
      'Start leads to Signed in?',
      'Signed in? leads to Home: yes',
    ]);
    await expect(page.locator('#order-state svg[role="img"]')).toBeVisible();

    // Nothing asked for Mermaid: no ui-mermaid-view, no (renderer mermaid).
    await page.waitForLoadState('networkidle');
    expect(mermaidRequests(requests)).toEqual([]);
    expect(requests.some((url) => url.includes('dagre.esm.js'))).toBe(true);
    expect(errors).toEqual([]);
    await screenshot(login, 'login-svg', testInfo);
  });

  test('imports Mermaid when a Mermaid diagram is shown', async ({
    page,
  }, testInfo) => {
    const { requests, errors } = await open(page);
    await page.waitForLoadState('networkidle');
    expect(mermaidRequests(requests)).toEqual([]);

    await page
      .getByRole('button', { name: 'Show the Mermaid examples' })
      .click();
    await expect(page.locator('body[data-ready="true"]')).toBeAttached();
    expect(mermaidRequests(requests).length).toBeGreaterThan(0);

    const views = page.locator('#mermaid-examples ui-mermaid-view');
    await expect(views).toHaveCount(3);
    for (const view of await views.all()) {
      await expect(view).toHaveAttribute('data-state', 'ready');
      await expect(view.locator('svg[role="img"]')).toBeVisible();
    }
    const login = page.locator('#login-mermaid');
    await expect(login).toHaveAttribute('data-renderer', 'mermaid');
    await expect(login.locator('svg')).toContainText('Signed in?');
    await expect(page.locator('#sign-in-sequence svg')).toContainText(
      'types a password'
    );
    expect(errors).toEqual([]);
    await screenshot(login, 'login-mermaid', testInfo);
  });

  test('shows the source and an error when Mermaid cannot be loaded', async ({
    page,
  }, testInfo) => {
    await page.route(`**${MERMAID}**`, (route) => route.abort());
    const { errors } = await open(page, '?mermaid');

    const view = page.locator('#login-mermaid ui-mermaid-view');
    await expect(view).toHaveAttribute('data-state', 'error');
    await expect(view.getByRole('alert')).toContainText(
      'The diagram could not be drawn with Mermaid'
    );
    await expect(view.locator('pre code')).toContainText(
      'start --> check{"Signed in?"}'
    );
    await expect(view.locator('svg')).toHaveCount(0);
    // Our renderer is not affected.
    await expect(page.locator('#login-svg svg[role="img"]')).toBeVisible();
    expect(errors).toEqual([]);
    await expectAccessible(page);
    await screenshot(
      page.locator('#login-mermaid'),
      'mermaid-blocked',
      testInfo
    );
  });

  test('is accessible before and after Mermaid is shown', async ({ page }) => {
    await open(page);
    await expectAccessible(page);
    await page
      .getByRole('button', { name: 'Show the Mermaid examples' })
      .click();
    await expect(page.locator('body[data-ready="true"]')).toBeAttached();
    await expectAccessible(page);
  });
});
