import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import AxeBuilder from '@axe-core/playwright';

// Only this small example bundle is built; no workspace source build.
test.beforeAll(async () => {
  await build({
    entryPoints: ['examples/themes/optical-frames/example.js'],
    bundle: true,
    format: 'esm',
    outfile: 'examples/themes/optical-frames/dist/example.js',
  });
});
test('independent optical frames preserve transparent cuts and accessible opaque content', async ({
  page,
}) => {
  await page.goto('/examples/themes/optical-frames/index.html');
  await page.waitForFunction(() => globalThis.framesReady);
  const geometry = await page
    .locator('article')
    .first()
    .evaluate((el) => {
      const material = el.querySelector('.material');
      const content = el.querySelector('.content');
      return {
        clip: globalThis.getComputedStyle(material).clipPath,
        opacity: globalThis.getComputedStyle(content).opacity,
        paths: el.querySelectorAll('path').length,
        fill: [...el.querySelectorAll('path')].every(
          (path) => path.getAttribute('fill') === 'none'
        ),
      };
    });
  expect(geometry.clip).toContain('path(');
  expect(geometry.opacity).toBe('1');
  expect(geometry.paths).toBe(8);
  expect(geometry.fill).toBe(true);
  const audit = await new AxeBuilder({ page }).analyze();
  expect(audit.violations).toEqual([]);
  await expect(page.locator('main')).toHaveScreenshot('optical-frames.png');
});
