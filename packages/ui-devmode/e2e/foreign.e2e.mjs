/* global chrome, activateTab */
import { mkdir, mkdtemp, readFile, writeFile, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { URL } from 'node:url';
import path from 'node:path';
import { test, expect, chromium } from '@playwright/test';
import { expectAccessible } from '../../../tests/ui/helpers.mjs';

const FIXTURE = '/packages/ui-devmode/tests/fixtures/foreign.html';
const CSP = FIXTURE.replace('foreign.html', 'foreign-csp.html');
const BUNDLE = path.resolve('packages/ui-devmode/dist/devmode.js');
const panel = (page) => page.locator('ui-foreign-devmode ui-devmode-inspector');
const row = (page, name) =>
  panel(page).locator(`tr[data-name="${name}"] input`);

// Build the delivery artifacts before starting the static server (see ui-tests.yml).
async function inject(page) {
  await page.addScriptTag({ path: BUNDLE });
  await page.evaluate(() => globalThis.linkUiForeignReady);
  await expect(panel(page)).toBeVisible();
}

test('foreign outline, DOM isolation, edits, exports, reload, mutation and toggle', async ({
  page,
}, info) => {
  await page.goto(FIXTURE);
  const before = await page.locator('body').evaluate((node) => node.outerHTML);
  if (process.env.UPDATE_DOCS_SCREENSHOTS === '1') {
    await mkdir('docs/screenshots', { recursive: true });
    await page.screenshot({
      path: 'docs/screenshots/ui-devmode-foreign-before.png',
      caret: 'initial',
    });
  }
  await inject(page);
  expect(
    await page.locator('body').evaluate((node) => {
      const clone = node.cloneNode(true);
      clone.querySelector('ui-foreign-devmode').remove();
      return clone.outerHTML;
    })
  ).toBe(before);
  const ids = await page.evaluate(() => [
    ...globalThis.linkUiForeignDevMode.adapter.tree().toDocument().byId.keys(),
  ]);
  expect(
    await panel(page)
      .getByRole('treeitem')
      .evaluateAll((nodes) => nodes.map((n) => n.dataset.id))
  ).toEqual(ids);
  await page.locator('#card-title').click();
  await panel(page)
    .getByRole('tab', { name: 'Properties', exact: true })
    .click();
  await row(page, 'text').fill('Migrated card');
  await row(page, 'style color').fill('#b3261e');
  await expect(page.locator('#card-title')).toHaveText('Migrated card');
  await expect(page.locator('#card-title')).toHaveCSS(
    'color',
    'rgb(179, 38, 30)'
  );
  await page.evaluate(() => globalThis.linkUiForeignDevMode.whenSaved());
  const exported = await page.evaluate(() => ({
    patch: globalThis.linkUiForeignDevMode.exportOverrides(),
    subtree: globalThis.linkUiForeignDevMode.exportSubtree(),
  }));
  expect(exported.patch.count).toBe(2);
  expect(exported.subtree).toContain('Migrated card');
  expect(
    exported.patch.links[0].values.filter(
      (link) => Array.isArray(link) && link[0] === 'set'
    )
  ).toHaveLength(2);
  await expectAccessible(page, { include: 'ui-foreign-devmode' });
  if (
    process.env.UPDATE_DOCS_SCREENSHOTS === '1' &&
    info.project.name === 'chromium'
  ) {
    await mkdir('docs/screenshots', { recursive: true });
    await page.screenshot({ path: 'docs/screenshots/ui-devmode-foreign.png' });
  }
  await page.reload();
  await inject(page);
  await expect(page.locator('#card-title')).toHaveText('Migrated card');
  await expect(page.locator('#card-title')).toHaveCSS(
    'color',
    'rgb(179, 38, 30)'
  );
  await page.evaluate(() => {
    globalThis.linkUiForeignDevMode.select('card-title');
    const item = document.createElement('h2');
    item.id = 'new-title';
    item.textContent = 'New card';
    document.querySelector('main').append(item);
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          globalThis.linkUiForeignDevMode.adapter.nodeFor('new-title')
            ?.textContent
      )
    )
    .toBe('New card');
  expect(
    await page.evaluate(() => globalThis.linkUiForeignDevMode.getSelection().id)
  ).toBe('card-title');
  await page.evaluate(() => {
    document.querySelector('#card-title').remove();
  });
  await expect
    .poll(() =>
      page.evaluate(() => globalThis.linkUiForeignDevMode.getSelection())
    )
    .toBe(null);
  await page.addScriptTag({ path: BUNDLE });
  await page.evaluate(() => globalThis.linkUiForeignReady);
  await expect(panel(page)).toHaveCount(0);
});

test('bookmarklet emits javascript URL and strict CSP blocks loader', async ({
  page,
}) => {
  const loader = await readFile(
    'packages/ui-devmode/dist/bookmarklet.txt',
    'utf8'
  );
  expect(new URL(loader).protocol).toBe('javascript:');
  await page.goto(FIXTURE);
  await page.addScriptTag({
    type: 'module',
    url: '/packages/ui-devmode/dist/foreign.js',
  });
  await page.evaluate(() => globalThis.linkUiForeignReady);
  await expect(panel(page)).toBeVisible();
  await page.goto(CSP);
  const blocked = await page.evaluate(
    () =>
      new Promise((resolve) => {
        document.addEventListener(
          'securitypolicyviolation',
          (event) => resolve(event.violatedDirective),
          { once: true }
        );
        const script = document.createElement('script');
        script.type = 'module';
        script.src = '/packages/ui-devmode/dist/foreign.js';
        document.documentElement.append(script);
      })
  );
  expect(blocked).toContain('script-src');
  await expect(panel(page)).toHaveCount(0);
});

test('unpacked MV3 action edits and restores a strict CSP page in an isolated world', async ({
  browserName,
}) => {
  test.skip(
    browserName !== 'chromium',
    'Manifest V3 is a Chromium delivery channel'
  );
  const folder = await mkdtemp(path.join(tmpdir(), 'links-ui-extension-'));
  const extension = path.join(folder, 'unpacked');
  await cp('packages/ui-devmode-extension/dist/unpacked', extension, {
    recursive: true,
  });
  const manifest = JSON.parse(
    await readFile(path.join(extension, 'manifest.json'), 'utf8')
  );
  // Automation cannot click browser chrome. Grant only the fixture origin in this
  // temporary test copy, then dispatch the registered action listener in the worker.
  manifest.host_permissions = ['http://127.0.0.1/*'];
  await writeFile(
    path.join(extension, 'manifest.json'),
    JSON.stringify(manifest)
  );
  const context = await chromium.launchPersistentContext(
    path.join(folder, 'profile'),
    {
      channel: 'chromium',
      executablePath: process.env.UI_DEVMODE_CHROMIUM_EXECUTABLE,
      headless: true,
      args: [
        `--disable-extensions-except=${extension}`,
        `--load-extension=${extension}`,
      ],
    }
  );
  try {
    const worker =
      context.serviceWorkers()[0] ??
      (await context.waitForEvent('serviceworker'));
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:4173${CSP}`);
    const activate = () =>
      worker.evaluate(async () => {
        const [tab] = await chrome.tabs.query({
          url: 'http://127.0.0.1:4173/*',
        });
        await activateTab(tab);
      });
    await activate();
    await expect(panel(page)).toBeVisible();
    await page.locator('#card-title').click();
    await panel(page)
      .getByRole('tab', { name: 'Properties', exact: true })
      .click();
    await row(page, 'text').fill('Extension card');
    await row(page, 'style color').fill('green');
    await expect(page.locator('#card-title')).toHaveText('Extension card');
    await expect
      .poll(() =>
        worker.evaluate(async () =>
          JSON.stringify(await chrome.storage.local.get(null))
        )
      )
      .toContain('Extension card');
    if (process.env.UPDATE_DOCS_SCREENSHOTS === '1') {
      await page.screenshot({
        path: 'docs/screenshots/ui-devmode-extension-csp.png',
      });
    }
    await page.reload();
    await activate();
    await expect(page.locator('#card-title')).toHaveText('Extension card');
    await expect(page.locator('#card-title')).toHaveCSS(
      'color',
      'rgb(0, 128, 0)'
    );
    expect(
      await page.evaluate(() => typeof globalThis.linkUiForeignDevMode)
    ).toBe('undefined');
    await activate();
    await expect(panel(page)).toHaveCount(0);
  } finally {
    await context.close();
    await rm(folder, { recursive: true, force: true });
  }
});
