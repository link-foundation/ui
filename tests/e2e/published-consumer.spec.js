import { rm } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { prepareConsumer } from '../../experiments/published-consumer/prepare.mjs';
import { buildConsumer } from '../../experiments/published-consumer/build.mjs';
import { expectAccessible } from '../ui/helpers.mjs';

test('production-only npm archives support an external Vite/React consumer', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const consumer = await prepareConsumer();
  let server;
  try {
    const built = await buildConsumer(consumer);
    expect(built.warnings).toEqual([]);
    server = await built.serve();
    const errors = [];
    const failures = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
      if (response.status() >= 400) {
        failures.push(response.url());
      }
    });
    await page.goto(server.resolvedUrls.local[0]);
    await expect(page.locator('#react ui-text')).toHaveText(
      'React from installed archives'
    );
    await expect(page.locator('#settings')).toHaveText('Settings default: 18');
    await expect(page.locator('#worker')).toHaveText(
      'Worker positioned 3 vertices'
    );
    await expect(page.locator('#icon path')).toHaveCount(1);
    await expect(page.locator('links-network svg')).toBeVisible();
    expect(
      await page
        .locator('links-network')
        .evaluate((node) => node.positions.size)
    ).toBe(3);
    await page
      .getByRole('button', { name: 'Open inspector', exact: true })
      .click();
    await expect(page.locator('#status')).toHaveText('Inspector open');
    await expect(
      page.locator('ui-foreign-devmode ui-devmode-inspector')
    ).toBeVisible();
    await expectAccessible(page, { include: 'main' });
    expect(errors).toEqual([]);
    expect(failures).toEqual([]);
    if (process.env.UI_RELEASE_SCREENSHOT) {
      await page.screenshot({
        path: process.env.UI_RELEASE_SCREENSHOT,
        fullPage: true,
      });
    }
  } finally {
    await page.evaluate(() => globalThis.inspector?.destroy()).catch(() => {});
    await new Promise((resolve) =>
      server ? server.httpServer.close(resolve) : resolve()
    );
    await rm(consumer.root, { recursive: true, force: true });
  }
});
