/* global window, document */
import { webkit } from 'playwright';
const browser = await webkit.launch();
try {
  const page = await browser.newPage({
    colorScheme: 'light',
    reducedMotion: 'reduce',
  });
  await page.goto(
    'http://127.0.0.1:4173/packages/ui-components/e2e/pages/overlays.html'
  );
  await page.waitForSelector('#app[data-ready="true"]');
  await page.evaluate(() => window.controller('node-menu').open());
  for (const theme of ['dark', 'light', 'dark']) {
    await page.emulateMedia({ colorScheme: theme });
    console.log(
      theme,
      await page.evaluate(async () => {
        const samples = [];
        const start = window.performance.now();
        for (let i = 0; i < 20; i++) {
          const node = document.querySelector('[data-link-id="node-menu"]');
          const style = window.getComputedStyle(node);
          const item = window.getComputedStyle(
            node.querySelector('[role="menuitem"]')
          );
          samples.push({
            ms: Math.round(window.performance.now() - start),
            bg: style.backgroundColor,
            fg: style.color,
            itemBg: item.backgroundColor,
            transition: item.transition,
            animations: document.getAnimations().length,
          });
          await new Promise(window.requestAnimationFrame);
        }
        return samples;
      })
    );
  }
} finally {
  await browser.close();
}
