import { expect, test } from '@playwright/test';
import { expectAccessible } from '../../../tests/ui/helpers.mjs';

const pageUrl = '/packages/ui-components/examples/embed.html';
const sdk = `window.twttr = { widgets: { createTweet(id, container, options) {
  const frame = document.createElement('iframe');
  frame.style.height = '160px';
  frame.srcdoc = '<!doctype html><html lang="en"><title>Provider fixture</title><body style="font:18px system-ui;padding:16px;background:' + (options.theme === 'dark' ? '#303134;color:#fafafa' : '#fff;color:#202124') + '"><p>Mock provider post</p><p>Theme: ' + options.theme + '</p></body></html>';
  container.append(frame);
  return Promise.resolve(frame);
} } };`;

async function mockProvider(page) {
  const requests = [];
  await page.route('https://platform.twitter.com/widgets.js', (route) => {
    requests.push(route.request().url());
    return route.fulfill({ contentType: 'application/javascript', body: sdk });
  });
  return requests;
}

test('far below the fold requests nothing; two near embeds share one SDK', async ({
  page,
}) => {
  const requests = await mockProvider(page);
  await page.goto(`${pageUrl}?far&count=2`);
  await expect(page.locator('ui-embed').first()).toHaveAttribute(
    'data-state',
    'deferred'
  );
  expect(requests).toHaveLength(0);
  await page.locator('ui-embed').first().scrollIntoViewIfNeeded();
  await expect(page.locator('ui-embed[data-loaded]')).toHaveCount(2);
  expect(requests).toHaveLength(1);
  await expect(page.locator('ui-embed iframe').first()).toHaveAttribute(
    'title',
    'Embedded post'
  );
  await expectAccessible(page);
});

test('theme changes while the SDK is loading leave one widget in the new theme', async ({
  page,
}) => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route('https://platform.twitter.com/widgets.js', async (route) => {
    await gate;
    await route.fulfill({ contentType: 'application/javascript', body: sdk });
  });
  await page.goto(pageUrl);
  await expect(page.locator('ui-embed')).toHaveAttribute(
    'data-state',
    'loading'
  );
  await page.locator('#theme').click();
  release();
  await expect(page.locator('ui-embed[data-loaded]')).toHaveCount(1);
  await expect(page.locator('ui-embed iframe')).toHaveCount(1);
  await expect(
    page.frameLocator('ui-embed iframe').locator('body')
  ).toContainText('Theme: dark');
});

test('timeout, archive toggle, keyboard and accessible screenshots', async ({
  page,
}, testInfo) => {
  await mockProvider(page);
  await page.goto(pageUrl);
  await expect(page.locator('ui-embed[data-loaded]')).toHaveCount(1);
  await expectAccessible(page);
  if (testInfo.project.name === 'chromium') {
    await page.screenshot({ path: 'docs/screenshots/embed-ready.png' });
  }
  await page.getByRole('button', { name: 'Show archive' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('ui-embed')).toHaveAttribute('data-state', 'off');
  await expect(
    page.getByRole('heading', { name: 'Archived post' })
  ).toBeVisible();
  await expectAccessible(page);
  if (testInfo.project.name === 'chromium') {
    await page.screenshot({ path: 'docs/screenshots/embed-archive.png' });
  }
  await page.getByRole('button', { name: 'Show embed' }).click();
  await expect(page.locator('ui-embed[data-loaded]')).toHaveCount(1);
  await page.evaluate(() => {
    window.embedErrors = [];
    const embed = document.querySelector('ui-embed');
    embed.addEventListener('ui-embed-error', (event) =>
      window.embedErrors.push(event.detail)
    );
    window.twttr.widgets.createTweet = () => new Promise(() => {});
    embed.setAttribute('timeout', '100');
  });
  await expect(page.locator('ui-embed')).toHaveAttribute(
    'data-state',
    'fallback'
  );
  expect(
    await page.evaluate(() => window.embedErrors.map((error) => error.reason))
  ).toEqual(['timeout']);
  await expectAccessible(page);
});

test('malicious ids never cause a provider request', async ({ page }) => {
  const requests = await mockProvider(page);
  for (const id of ['42&x=1', '//host']) {
    await page.goto(`${pageUrl}?id=${encodeURIComponent(id)}`);
    await expect(page.locator('ui-embed')).toHaveAttribute(
      'data-state',
      'fallback'
    );
    await expect(page.locator('ui-embed iframe')).toHaveCount(0);
  }
  expect(requests).toHaveLength(0);
});
