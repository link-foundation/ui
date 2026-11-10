// Inspect palette configuration and markup alongside scripts/serve-static.mjs.
import { chromium } from 'playwright';
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  page.on('console', (message) => console.log(message.text()));
  page.on('pageerror', (error) => console.error(error.message));
  await page.goto(
    'http://127.0.0.1:4173/packages/ui-components/examples/settings-gallery.html'
  );
  await page.waitForSelector('settings-panel');
  console.log(
    await page.evaluate(() => ({
      schema:
        globalThis.window.gallery.schema.fields.get('accent').props.palettes,
      palette: globalThis.document.querySelector('[data-part=palette]')
        .outerHTML,
    }))
  );
} finally {
  await browser.close();
}
