import { URLSearchParams } from 'node:url';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  createLinksServer,
  createLinksNames,
  createMemoryLinks,
} from '@link-foundation/ui-links';
import { listenLinksWebSocket } from '@link-foundation/ui-links/websocket-server';
import {
  createStore,
  encodeDocument,
  writeDocumentLinks,
} from '@link-foundation/ui-store';

test('two browsers edit a live UI document and undo only their own changes', async ({
  page,
  context,
}) => {
  const links = createMemoryLinks();
  const store = createStore({
    text: 'app: column\n  a: text First\n  b: text Second',
  });
  const { roots } = writeDocumentLinks(
    encodeDocument(store.toDocument()),
    links,
    createLinksNames(links)
  );
  const listener = await listenLinksWebSocket(
    createLinksServer({ links, names: createLinksNames(links) })
  );
  const other = await context.newPage();
  try {
    const params = new URLSearchParams({ server: listener.url });
    roots.forEach((id) => params.append('root', String(id)));
    const url = `/packages/ui-store/examples/live-links.html?${params}`;
    await page.goto(url);
    await other.goto(url);
    for (const tab of [page, other]) {
      await expect(tab.getByRole('status')).toHaveText('Connected');
    }
    await Promise.all([
      page.getByLabel('First node').fill('Alice'),
      other.getByLabel('Second node').fill('Bob'),
    ]);
    for (const tab of [page, other]) {
      await expect(tab.getByLabel('First node')).toHaveValue('Alice');
      await expect(tab.getByLabel('Second node')).toHaveValue('Bob');
    }
    expect(await page.locator('#document').textContent()).toBe(
      await other.locator('#document').textContent()
    );
    for (const colorScheme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme });
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    }
    await page.emulateMedia({ colorScheme: 'light' });
    await test.info().attach('converged-document', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    await page.getByRole('button', { name: 'Undo my edit' }).click();
    for (const tab of [page, other]) {
      await expect(tab.getByLabel('First node')).toHaveValue('First');
      await expect(tab.getByLabel('Second node')).toHaveValue('Bob');
    }
  } finally {
    await other.close();
    await page.close();
    await listener.close();
  }
});
