import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { expectAccessible } from '../ui/helpers.mjs';

import './fixtures/recorder-generated.mjs';

test('records, scrubs backward and replays with no drift', async ({
  page,
}, testInfo) => {
  await page.goto('/examples/animation/');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Record', exact: true }).click();
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.locator('#recording')).toContainText(
    'input pointer down ok'
  );
  await expect(page.locator('#recording')).toContainText('play press-feedback');
  const seek = async (end) =>
    page.locator('#scrubber').evaluate((node, last) => {
      node.value = last ? node.max : '0';
      node.dispatchEvent(new window.Event('input', { bubbles: true }));
    }, end);
  const snapshot = () =>
    page.evaluate(() => window.animationExample.store.toLino());
  await seek(true);
  const first = await snapshot();
  await seek(false);
  await seek(true);
  expect(await snapshot()).toBe(first);
  await page.getByRole('button', { name: 'Replay', exact: true }).click();
  await expect(page.locator('#status')).toHaveText('replay finished');
  expect(await snapshot()).toBe(first);
  await expectAccessible(page);
  // A second session still receives inputs after replay rebuilt the DOM.
  await page.getByRole('button', { name: 'Record', exact: true }).click();
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.locator('#recording')).toContainText('set ok pressed true');
  await page.locator('#recording').evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  const body = await page.locator('main').screenshot();
  await testInfo.attach('recorder', { body, contentType: 'image/png' });
  if (process.env.RECORDER_SCREENSHOTS) {
    mkdirSync(process.env.RECORDER_SCREENSHOTS, { recursive: true });
    writeFileSync(join(process.env.RECORDER_SCREENSHOTS, 'recorder.png'), body);
  }
});
