import { test, expect } from '@playwright/test';
import { expectAccessible } from '../../../../tests/ui/helpers.mjs';

const path = '/packages/ui-components/examples/lino-network.html';
const view = (page) => page.locator('#network');
async function open(page) {
  await page.goto(path);
  await page.waitForFunction(
    () => document.querySelector('#network')?.network?.links.size > 0
  );
  await view(page).evaluate((el) => el.ready);
  await expect(view(page).locator('svg')).toBeVisible();
}

test('clicking a point reports its source line and highlights the source token', async ({
  page,
}) => {
  await open(page);
  await view(page).evaluate(async (el) => {
    el.removeAttribute('src');
    el.lino = 'a: hello world\nb: a hello';
    await el.ready;
    el.addEventListener('select', (event) => {
      el.dataset.selected = JSON.stringify(event.detail);
    });
  });
  await expect(view(page).locator('[data-point="hello"]')).toBeVisible();
  await view(page).locator('[data-point="hello"]').click();
  expect(JSON.parse(await view(page).getAttribute('data-selected'))).toEqual({
    id: 'hello',
    line: 1,
    column: 4,
  });
  await expect(view(page).locator('mark')).toHaveText('hello');
  await expect(page.getByRole('status').first()).toHaveText(
    'hello · line 1, column 4'
  );
  await view(page).evaluate((el) => el.select('b'));
  await expect(view(page).locator('mark')).toHaveText('b');
  expect(JSON.parse(await view(page).getAttribute('data-selected')).line).toBe(
    2
  );
  await view(page).evaluate((el) => el.select(null));
  await expect(view(page).locator('mark')).toHaveCount(0);
});

test('inline text, dynamic text, quoted and isolated points work with real workers and every layout', async ({
  page,
}) => {
  await open(page);
  const inline = await page.evaluateHandle(() => {
    const node = document.createElement('lino-network');
    node.textContent = "a: 'hello' world\nsolo";
    document.querySelector('main').append(node);
    return node;
  });
  await inline.evaluate((el) => el.ready);
  expect(await inline.evaluate((el) => el.network.points.size)).toBe(3);
  for (const layout of [
    'circle',
    'grid',
    'hex',
    'spiral',
    'force',
    'layered',
  ]) {
    await inline.evaluate(async (el, layout) => {
      el.setAttribute('layout', layout);
      await el.networkView.ready;
    }, layout);
    expect(
      await inline.evaluate((el) =>
        [...el.networkView.positions.values()].every(
          (p) => Number.isFinite(p.x) && Number.isFinite(p.y)
        )
      )
    ).toBe(true);
    expect(
      await inline.evaluate((el) => el.networkView.positions.has('solo'))
    ).toBe(true);
  }
  await inline.evaluate((el) => {
    el.textContent = 'replacement';
  });
  await expect
    .poll(() => inline.evaluate((el) => el.network.points.has('replacement')))
    .toBe(true);
  await inline.evaluate(async (el) => {
    el.remove();
    document.querySelector('main').append(el);
    await el.ready;
  });
  expect(
    await inline.evaluate((el) => el.network.points.has('replacement'))
  ).toBe(true);
  await inline.dispose();
});

test('syntax errors and unresolved references show diagnostic positions', async ({
  page,
}) => {
  await open(page);
  await page.getByLabel('Sample').selectOption('syntax-error');
  await expect(
    view(page).getByRole('list', { name: 'Diagnostics' })
  ).toContainText('error: 2:12');
  expect(await view(page).evaluate((el) => el.network.links.size)).toBe(0);
  await view(page).evaluate(async (el) => {
    el.lino = 'a: hello 42';
    await el.ready;
  });
  await expect(
    view(page).getByRole('list', { name: 'Diagnostics' })
  ).toContainText('warning: 1:10');
});

test('the sample chooser loads only the bundled case-study files', async ({
  page,
}) => {
  await open(page);
  for (const sample of [
    'tokens',
    'animation',
    'assets',
    'indented',
    'overrides',
    'styles',
    'document',
  ]) {
    await page.getByLabel('Sample').selectOption(`${sample}.lino`);
    await view(page).evaluate((el) => el.ready);
    expect(
      await view(page).evaluate((el) => el.network.links.size)
    ).toBeGreaterThan(0);
    expect(
      await view(page).evaluate((el) =>
        el.diagnostics.some((d) => d.severity === 'error')
      )
    ).toBe(false);
  }
  const source = await view(page).getAttribute('src');
  await page.getByLabel('Sample').evaluate((select) => {
    select.append(new globalThis.Option('Unknown', 'unknown.lino'));
  });
  await page.getByLabel('Sample').selectOption('unknown.lino');
  await view(page).evaluate((el) => el.ready);
  expect(await view(page).getAttribute('src')).toBe(source);
});

test('src failures clear stale views and newer loads win', async ({ page }) => {
  await open(page);
  await page.route('**/missing.lino', (route) =>
    route.fulfill({ status: 404, body: 'Missing' })
  );
  await view(page).evaluate(async (el) => {
    el.setAttribute('src', '/missing.lino');
    await el.ready;
  });
  await expect(view(page).getByRole('list')).toContainText('404');
  expect(await view(page).evaluate((el) => el.network.links.size)).toBe(0);
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  await page.route('**/slow.lino', async (route) => {
    await pending;
    await route.fulfill({ body: 'stale: a b' });
  });
  await view(page).evaluate((el) => el.setAttribute('src', '/slow.lino'));
  await view(page).evaluate(async (el) => {
    el.setAttribute('src', '/docs/case-studies/issue-1/samples/tokens.lino');
    await el.ready;
  });
  release();
  expect(
    await view(page).evaluate((el) => el.network.links.has('material3'))
  ).toBe(true);
  expect(await view(page).evaluate((el) => el.network.links.has('stale'))).toBe(
    false
  );
});

test('keyboard selection links to source and both themes pass WCAG 2.2 AA', async ({
  page,
}) => {
  await open(page);
  await view(page).locator('links-network').focus();
  await page.keyboard.press('Home');
  await expect(view(page).locator('mark')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(view(page).locator('mark')).toHaveCount(0);
  for (const theme of ['light', 'dark']) {
    await page.getByLabel('Theme').selectOption(theme);
    await expectAccessible(page);
  }
});
