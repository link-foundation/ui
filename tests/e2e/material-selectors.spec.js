import process from 'node:process';
import { test, expect } from '@playwright/test';
import { expectAccessible } from '../ui/helpers.mjs';

// Use the real theme registry and browser module import map.
test('HIG material scope roots blur while nested theme boundaries remain opaque', async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== 'chromium',
    'Transparency media emulation uses CDP.'
  );
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setEmulatedMedia', {
    features: [
      { name: 'prefers-reduced-transparency', value: 'no-preference' },
    ],
  });
  await page.goto('/examples/themes/hig.html');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await page.evaluate(async () => {
    const { buildCss } = await import('@link-foundation/ui-dom');
    const { loadTheme } = await import('@link-foundation/ui-themes');
    const style = document.createElement('style');
    style.textContent = buildCss({
      themeRegistry: new Map([['hig', await loadTheme('hig')]]),
    });
    document.head.append(style);
    document.body.innerHTML = `<main>
      <h1>HIG material theme roots</h1>
      <p>Regular, thin and thick surfaces, with an opaque nested theme boundary.</p>
      ${['regular', 'thin', 'thick']
        .map(
          (
            name
          ) => `<section data-theme="hig" material="${name}" aria-label="${name}">
          <h2>${name}</h2><p>Material at the theme root</p>
          <section data-theme="other" material="${name}" aria-label="Nested ${name}">
            <h3>Nested theme boundary</h3><p>Outer material does not cross here.</p>
          </section>
        </section>`
        )
        .join('')}
    </main>`;
    const layout = document.createElement('style');
    layout.textContent = `body { margin: 0; background: repeating-linear-gradient(45deg, #dde8ff 0 30px, #fff 30px 60px); color: #111; font: 16px system-ui; }
      main { padding: 24px; } h1 { margin-top: 0; }
      main > section { display: inline-block; vertical-align: top; width: 280px; margin: 8px; padding: 20px; border: 1px solid #333; border-radius: 12px; }
      section section { padding: 12px; background: white; border: 1px solid #333; }`;
    document.head.append(layout);
  });
  if (process.env.MATERIAL_SCREENSHOT) {
    await page.screenshot({ path: process.env.MATERIAL_SCREENSHOT });
  }
  const roots = page.locator('main > section');
  for (const [index, blur] of ['20px', '12px', '30px'].entries()) {
    await expect(roots.nth(index)).toHaveCSS(
      'backdrop-filter',
      `blur(${blur})`
    );
  }
  const nested = roots.locator('section');
  for (const node of await nested.all()) {
    await expect(node).toHaveCSS('backdrop-filter', 'none');
  }
  await expectAccessible(page);
  await session.detach();
});
