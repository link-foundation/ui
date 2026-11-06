import { rm } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { buildConsumer } from '../../experiments/vite-consumer/build.mjs';
import { expectAccessible } from '../ui/helpers.mjs';

test.describe('external packed Vite consumer', () => {
  test.describe.configure({ timeout: 120_000 });
  for (const { inline, withDoubletsWeb } of [
    { inline: false, withDoubletsWeb: false },
    { inline: true, withDoubletsWeb: false },
    { inline: false, withDoubletsWeb: true },
    { inline: true, withDoubletsWeb: true },
  ]) {
    test(`opens the inspector with ${inline ? 'inlined' : 'emitted'} assets and doublets-web ${withDoubletsWeb ? 'installed' : 'absent'}`, async ({
      page,
    }) => {
      const consumer = await buildConsumer({ inline, withDoubletsWeb });
      let server;
      try {
        expect(consumer.warnings).toEqual([]);
        server = await consumer.serve();
        const errors = [];
        const failures = [];
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('response', (response) => {
          if (response.status() >= 400) {
            failures.push(response.url());
          }
        });
        await page.goto(server.resolvedUrls.local[0]);
        await expect(page.locator('#rendered ui-text')).toHaveText(
          'Mounted document'
        );
        await page.evaluate(() =>
          globalThis.mountedStore.setPositional('greeting', [
            'Updated document',
          ])
        );
        await expect(page.locator('#rendered ui-text')).toHaveText(
          'Updated document'
        );
        await page
          .getByRole('button', { name: 'Open inspector', exact: true })
          .click();
        await expect(page.locator('#status')).toHaveText('Inspector open');
        const panel = page.locator('ui-foreign-devmode ui-devmode-inspector');
        await expect(panel).toBeVisible();
        await expect(
          panel.locator('[role=treeitem][data-id=title]')
        ).toBeVisible();
        expect(await page.evaluate(() => globalThis.consumerResult.text)).toBe(
          'Close'
        );
        expect(
          await page.evaluate(() => globalThis.consumerResult.ids)
        ).toContain('title');
        await page.evaluate(() => globalThis.controller.select('title'));
        await expectAccessible(page, { include: 'ui-foreign-devmode' });
        expect(
          await page.evaluate(() => globalThis.consumerResult.instruction)
        ).toContain('Make these UI overrides the defaults of consumer.');
        expect(errors).toEqual([]);
        expect(failures).toEqual([]);
      } finally {
        await page.evaluate(() => globalThis.controller?.destroy());
        await new Promise((resolve) =>
          server ? server.httpServer.close(resolve) : resolve()
        );
        await rm(consumer.root, { recursive: true, force: true });
      }
    });
  }
});
