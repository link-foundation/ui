import { test } from '@playwright/test';
import './fixtures/recorder-native-generated.mjs';

test.afterEach(async ({ page }, info) => {
  await info.attach('native-keyboard', {
    body: await page
      .locator('body')
      .screenshot({ path: info.outputPath('native-keyboard.png') }),
    contentType: 'image/png',
  });
});
