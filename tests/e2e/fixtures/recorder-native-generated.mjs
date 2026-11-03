import { test, expect } from '@playwright/test';

// prettier-ignore
test('recorded session', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.clock.install();
  await page.goto("/tests/ui/pages/recorder-native.html");
  const target = (id) => { const host = page.locator(`[data-link-id=${JSON.stringify(id)}]`); return host.locator("button, input, textarea, select").or(host).last(); };
  await target("ok").focus();
  await page.clock.runFor(10);
  await target("ok").focus();
  await page.keyboard.down("Enter");
  await expect(page.locator("[data-link-id=\"ok\"]")).toHaveText("Saved");
  await page.clock.runFor(10);
  await target("ok").focus();
  await page.keyboard.up("Enter");
  await page.clock.runFor(10);
  await target("field").focus();
  await page.clock.runFor(10);
  await target("field").focus();
  await page.keyboard.down("a");
  if (await target("field").evaluate(node => String(node.value ?? node.textContent ?? '')) !== "a") { await target("field").fill("a"); }
  await expect(page.locator("[data-link-id=\"count\"]")).toHaveText("1");
  await page.clock.runFor(10);
  await target("field").focus();
  await page.keyboard.up("a");
});
