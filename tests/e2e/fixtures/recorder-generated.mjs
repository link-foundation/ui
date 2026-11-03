import { test, expect } from '@playwright/test';

// prettier-ignore
test('recorded session', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.clock.install();
  await page.goto("/examples/animation/");
  const target = (id) => { const host = page.locator(`[data-link-id=${JSON.stringify(id)}]`); return host.locator("button, input, textarea, select").or(host).last(); };
  await test.step("press OK", async () => {});
  await page.clock.runFor(10);
  { const box = await target("ok").boundingBox(); await page.mouse.move(box.x + 12, box.y + 8); }
  await page.mouse.down({ button: "left" });
  await expect.poll(() => page.evaluate(([id, name]) => globalThis.uiRecordingState(id, name), ["ok","pressed"])).toEqual(["true"]);
  await page.clock.runFor(20);
  { const box = await target("ok").boundingBox(); await page.mouse.move(box.x + 12, box.y + 8); }
  await page.mouse.up({ button: "left" });
  await expect.poll(() => page.evaluate(([id, name]) => globalThis.uiRecordingState(id, name), ["ok","pressed"])).toEqual(["false"]);
});
