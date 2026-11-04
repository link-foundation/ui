import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  createLinksServer,
  createMemoryLinks,
} from '@link-foundation/ui-links';
import { listenLinksWebSocket } from '@link-foundation/ui-links/websocket-server';

for (const binary of [false, true]) {
  test(`two tabs sync over ${binary ? 'binary' : 'text'} WebSocket messages`, async ({
    context,
    page,
  }) => {
    const server = createLinksServer({ links: createMemoryLinks() });
    const listener = await listenLinksWebSocket(server);
    const other = await context.newPage();
    try {
      const url = `/tests/ui/pages/links-websocket.html?server=${encodeURIComponent(listener.url)}&binary=${binary}`;
      await page.goto(url);
      await other.goto(url);
      for (const tab of [page, other]) {
        await expect(tab.getByRole('status')).toHaveText(
          `Connected (${binary ? 'binary' : 'text'})`
        );
      }
      await page.getByRole('button', { name: 'Create link' }).click();
      await expect(other.locator('#links')).toHaveText('(1: 0 0)');
      await other.getByRole('button', { name: 'Create link' }).click();
      for (const tab of [page, other]) {
        await expect(tab.locator('#links')).toHaveText('(1: 0 0)\n(2: 0 0)');
      }
      expect(server.links.count()).toBe(2);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await test.info().attach('synced-tabs', {
        body: await page.screenshot(),
        contentType: 'image/png',
      });
    } finally {
      await other.close();
      await page.close();
      await listener.close();
    }
  });
}
