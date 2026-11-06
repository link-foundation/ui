// Bounded WebKit probe for the taller continuous-number integration fixture.
import { webkit } from '@playwright/test';
const browser = await webkit.launch();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 320 } });
  await page.goto(
    'http://127.0.0.1:4173/packages/ui-components/examples/control-contracts.html?fallback'
  );
  await page.locator('body[data-ready=true]').waitFor();
  await page.getByRole('combobox', { name: 'Palette', exact: true }).click();
  if (process.argv[2]) {
    await page.screenshot({ path: process.argv[2] });
  }
  console.log(
    await page.getByRole('listbox').evaluate((list) => ({
      rect: list.getBoundingClientRect().toJSON(),
      style: list.getAttribute('style'),
      scrollY: globalThis.scrollY,
      innerHeight: globalThis.innerHeight,
      viewport: {
        height: globalThis.visualViewport.height,
        offset: globalThis.visualViewport.offsetTop,
      },
      anchor: globalThis.document
        .querySelector('[role=combobox]')
        .getBoundingClientRect()
        .toJSON(),
    }))
  );
} finally {
  await browser.close();
}
