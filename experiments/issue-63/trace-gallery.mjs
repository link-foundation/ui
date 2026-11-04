import { chromium } from '@playwright/test';
const browser = await chromium.launch({
  executablePath: '/opt/google/chrome/chrome',
});
try {
  const page = await browser.newPage();
  let matrices = 0;
  page.on('request', (request) => {
    if (request.url().includes('/gallery/')) {
      matrices++;
      console.log('matrix', matrices, request.url());
    }
  });
  await page.goto('http://127.0.0.1:4173/packages/site/dist/en/components/');
  await page.waitForFunction(
    () => globalThis.document.body.dataset.ready === 'true'
  );
  console.log('ready', matrices);
  await page.locator('summary').first().click();
  await page.frameLocator('iframe').first().locator('figure').first().waitFor();
  console.log('expanded', matrices);
} finally {
  await browser.close();
}
