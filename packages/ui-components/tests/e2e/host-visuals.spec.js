import { expect, test } from '@playwright/test';
import { expectAccessible } from '../../../../tests/ui/helpers.mjs';

const EXAMPLE = '/packages/ui-components/examples/host-visuals.html';

async function open(page) {
  await page.goto(EXAMPLE);
  await expect(page.locator('#host-chart button')).toHaveCount(2);
}

async function overflowAtCorner(page, tooltip, anchorY) {
  await expect(tooltip).toBeVisible();
  await expect
    .poll(async () => {
      const { x, y, width, height } = await tooltip.boundingBox();
      const frame = await page.locator('#clipped').boundingBox();
      const viewport = page.viewportSize();
      return (
        x >= 0 &&
        x + width <= viewport.width &&
        y >= 0 &&
        y + height <= viewport.height &&
        x < frame.x &&
        y <= anchorY + 1
      );
    })
    .toBe(true);
}

test('host chart preserves data, focus and both viewport edges', async ({
  page,
}) => {
  await open(page);
  const host = page.locator('#host-chart');
  const weekday = host.getByRole('button', { name: 'Weekday' });
  const weekend = host.getByRole('button', { name: 'Weekend' });
  const overlay = page.locator('#chart-overlays');
  const tooltip = overlay.getByRole('tooltip');
  await expect(
    page.getByRole('table', { name: 'Sample counts' })
  ).toContainText('Weekend12');
  await weekday.focus();
  await page.keyboard.press('ArrowRight');
  await expect(weekend).toBeFocused();
  await expect(weekend).toHaveAccessibleDescription(
    /Weekend · 12 contributions/
  );
  await expect(overlay.getByRole('status')).toHaveText(
    'Weekend · 12 contributions'
  );
  await overflowAtCorner(page, tooltip, (await weekend.boundingBox()).y);
  await page.keyboard.press('Escape');
  await expect(tooltip).toBeHidden();
  const mark = await weekend.boundingBox();
  await weekend.hover({ position: { x: mark.width - 4, y: mark.height - 4 } });
  await expect(tooltip).toContainText('12 contributions');
  await overflowAtCorner(page, tooltip, mark.y + mark.height - 12);
  await expectAccessible(page);
});

test('registered calendar, ongoing range and stat tile share one overlay', async ({
  page,
}) => {
  await open(page);
  const tooltip = page.locator('#chart-overlays [role=tooltip]');
  await page.locator('#contributions .ui-chart-canvas').focus();
  await page.keyboard.press('Home');
  await expect(tooltip).toContainText('2 janvier');
  await page.keyboard.press('ArrowDown');
  await expect(tooltip).toContainText('3 janvier');
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await expect(tooltip).toContainText('9 janvier');
  await page.locator('#timeline .ui-chart-marks rect[tabindex]').focus();
  await expect(tooltip).toContainText('Documentation · through 1 juin');
  await expect(page.locator('#timeline table tbody')).toContainText('ongoing');
  await page.locator('#total svg').focus();
  await expect(tooltip).toContainText('123,456 contributions');
  await expect(tooltip).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('[role=tooltip]')).toHaveCount(1);
  await expect(page.locator('#total + a')).toHaveAttribute('href', '#notes');
});

test('a host can reposition the shared tooltip and refresh its chart theme', async ({
  page,
}) => {
  await open(page);
  await page.evaluate(async () => {
    const { configureChartDocument } =
      await import('/packages/ui-components/src/charts/index.js');
    const root = document.querySelector('#chart-overlays');
    const presentation = configureChartDocument(document, {
      overlayRoot: root,
      theme: () => root.dataset.mode ?? 'light',
      positionTooltip(tooltip, anchor, { trigger }) {
        tooltip.dataset.anchor = anchor.nodeType
          ? anchor.localName
          : anchor.contextElement.localName;
        tooltip.dataset.trigger = trigger;
        tooltip.style.left = '24px';
        tooltip.style.top = '24px';
      },
    });
    root.addEventListener('theme-change', () => presentation.refresh());
    root.addEventListener('remove-presentation', () => presentation.destroy());
  });
  const mark = page.locator('#host-chart button').last();
  const root = page.locator('#chart-overlays');
  const tooltip = root.getByRole('tooltip');
  await mark.focus();
  await expect(tooltip).toHaveAttribute('data-trigger', 'focus');
  await expect(tooltip).toHaveAttribute('data-anchor', 'button');
  await expect(tooltip).toHaveCSS('left', '24px');
  await mark.hover();
  await expect(tooltip).toHaveAttribute('data-trigger', 'pointer');
  await expect(tooltip).toHaveAttribute('data-anchor', 'button');
  await root.evaluate((element) => {
    element.dataset.mode = 'dark';
    element.dispatchEvent(
      new element.ownerDocument.defaultView.Event('theme-change')
    );
  });
  await expect(tooltip).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('#total')).toHaveAttribute(
    'data-ui-chart-theme',
    'dark'
  );
  await root.dispatchEvent('remove-presentation');
  await expect(root.locator('[role=tooltip]')).toHaveCount(0);
  await expect(mark).not.toHaveAttribute('aria-describedby');
});

test.describe('touch interaction', () => {
  test.use({ hasTouch: true });
  test('taps toggle the tooltip while the host footnote remains a normal link', async ({
    page,
  }) => {
    await open(page);
    const mark = page.locator('#total svg');
    const tooltip = page.getByRole('tooltip');
    await mark.tap();
    await expect(tooltip).toContainText('123,456 contributions');
    await mark.tap();
    await expect(tooltip).toBeHidden();
    await page.locator('#total + a').tap();
    await expect(page).toHaveURL(/#notes$/);
  });
});

for (const direction of ['ltr', 'rtl']) {
  test(`host section links focus anchors and update fades after late layout in ${direction}`, async ({
    page,
  }) => {
    await open(page);
    const nav = page.getByRole('navigation', { name: 'Sections' });
    const top = nav.getByRole('link', { name: 'Back to top' });
    const notes = nav.getByRole('link', { name: 'Data notes and sources' });
    await nav.evaluate((element, dir) => {
      element.dir = dir;
      element.style.maxWidth = '100%';
    }, direction);
    await expect(nav).not.toHaveAttribute('data-more');
    await nav.evaluate((element) => {
      element.style.maxWidth = '15rem';
    });
    await expect(nav).toHaveAttribute('data-more', 'end');
    await notes.evaluate((element) => element.click());
    await expect(page.locator('#notes')).toBeFocused();
    await expect(notes).toHaveAttribute('aria-current', 'location');
    await expect(nav).toHaveAttribute('data-more', 'start');
    await top.locator('svg').evaluate((element) => {
      element.dispatchEvent(
        new element.ownerDocument.defaultView.MouseEvent('click', {
          bubbles: true,
          cancelable: true,
        })
      );
    });
    await expect(
      page.getByRole('heading', { name: 'Project activity' })
    ).toBeFocused();
    await expect(page).toHaveURL(/#top$/);
    await expect(nav).toHaveAttribute('data-more', 'end');
  });
}

test('host asset picker and play control preserve labels, IDs and keyboard behavior', async ({
  page,
}) => {
  await page.goto('/packages/ui-components/examples/rich-settings.html');
  await expect(page.getByRole('tab', { name: 'Shape' })).toBeVisible();
  const artwork = page.getByRole('combobox', { name: 'Frame artwork' });
  const id = await artwork.getAttribute('id');
  await expect(artwork).toHaveAccessibleDescription(
    'Choose a pattern for the preview frame.'
  );
  await artwork.selectOption('orbit');
  await expect(page.locator('.frame-preview .orbit-preview')).toBeVisible();
  await expect(artwork).toHaveAttribute('id', id);
  const play = page.getByRole('button', { name: 'Play preview' });
  await play.focus();
  await page.keyboard.press('Space');
  await expect(play).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.frame-preview .inset-preview')).toBeVisible();
  await page.getByRole('tab', { name: 'Shape' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Fit' })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  await page.keyboard.press('ArrowLeft');
  await expect(artwork).toHaveAttribute('id', id);
});
