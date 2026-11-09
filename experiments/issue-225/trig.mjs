import { chromium, webkit } from '@playwright/test';
for (const [name, type] of [
  ['chromium', chromium],
  ['webkit', webkit],
]) {
  const browser = await type.launch(
    name === 'chromium'
      ? {
          executablePath: process.env.FRAME_BROWSER ?? '/usr/bin/google-chrome',
        }
      : {}
  );
  try {
    const page = await browser.newPage();
    await page.setContent(
      '<div style="width:320px;height:200px;position:relative;container-type:size"><div id="p" style="position:absolute;inset:0"></div></div>'
    );
    console.log(
      name,
      await page.evaluate(() => {
        const p = globalThis.document.getElementById('p');
        return [
          'tan(atan2(320px, 60px))',
          'tan(atan2(100cqw, 60px))',
          'tan(atan2(100cqh, 90px))',
          'min(1, tan(atan2(320px, 60px)))',
          'calc(320px / 60px)',
          'calc(100cqw / 60px)',
        ].map((expr) => {
          p.style.width = `calc(1px * ${expr})`;
          return [expr, p.style.width, globalThis.getComputedStyle(p).width];
        });
      })
    );
  } finally {
    await browser.close();
  }
}
