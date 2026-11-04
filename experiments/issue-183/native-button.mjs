/**
 * Bounded native-theme probe. Serve with scripts/serve-static.mjs first.
 * Run in the workflow's pinned Playwright image:
 * node experiments/issue-183/native-button.mjs /tmp/issue183-evidence/before
 * Optional second argument: the base URL (default http://127.0.0.1:4173).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { webkit } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { WCAG_TAGS } from '../../tests/ui/helpers.mjs';

const destination = process.argv[2];
if (!destination) {
  throw new Error('Supply an evidence directory');
}
await mkdir(destination, { recursive: true });
const browser = await webkit.launch();
try {
  const evidence = [];
  for (const colorScheme of ['light', 'dark']) {
    const context = await browser.newContext({
      colorScheme,
      viewport: { width: 1280, height: 800 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    await page.goto(
      `${process.argv[3] ?? 'http://127.0.0.1:4173'}/packages/ui-devmode/examples/`
    );
    await page.locator('#app[data-ready=true]').waitFor();
    const button = page.locator('#forget');
    for (const phase of ['loaded', 'painted', 'delayed']) {
      if (phase === 'painted') {
        await page.evaluate(
          () =>
            new Promise((resolve) =>
              globalThis.requestAnimationFrame(() =>
                globalThis.requestAnimationFrame(resolve)
              )
            )
        );
      }
      // Deliberate finite probe, not synchronization in a regression test.
      if (phase === 'delayed') {
        await page.waitForTimeout(1000);
      }
      const styles = await button.evaluate((element) => {
        const style = globalThis.getComputedStyle(element);
        return {
          color: style.color,
          backgroundColor: style.backgroundColor,
          appearance: style.appearance,
          colorScheme: style.colorScheme,
        };
      });
      await button.screenshot({
        path: `${destination}/${colorScheme}-${phase}.png`,
      });
      const results = await new AxeBuilder({ page })
        .include('#forget')
        .withTags(WCAG_TAGS)
        .analyze();
      const contrast = ['passes', 'violations', 'incomplete'].flatMap(
        (status) =>
          results[status]
            .filter((result) => result.id === 'color-contrast')
            .map((result) => ({ status, nodes: result.nodes }))
      );
      evidence.push({ colorScheme, phase, styles, contrast });
    }
    await page.screenshot({ path: `${destination}/${colorScheme}-page.png` });
    await context.close();
  }
  await writeFile(
    `${destination}/measurements.json`,
    `${JSON.stringify(evidence, null, 2)}\n`
  );
  console.log(
    JSON.stringify(
      evidence.map(({ colorScheme, phase, styles, contrast }) => ({
        colorScheme,
        phase,
        styles,
        contrast: contrast.map(({ status }) => status),
      })),
      null,
      2
    )
  );
} finally {
  await browser.close();
}
