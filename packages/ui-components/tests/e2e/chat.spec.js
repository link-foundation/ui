import { test, expect } from '@playwright/test';
import { join } from 'node:path';
import { expectAccessible } from '../../../../tests/ui/helpers.mjs';
const row = (page, id) => page.locator(`[data-message="${id}"]`);
const scroll = (page) => page.locator('.ui-chat-scroll');
async function settle(page) {
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        window.requestAnimationFrame(() =>
          window.requestAnimationFrame(resolve)
        )
      )
  );
}
async function open(page) {
  await page.goto('/packages/ui-components/examples/chat.html');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await expect(row(page, 'm9999')).toBeVisible();
  await settle(page);
}
async function shot(page, name, info) {
  if (process.env.CHAT_DOCS_SCREENSHOTS && info.project.name === 'chromium') {
    await page.locator('.workspace').screenshot({
      path: join(
        import.meta.dirname,
        '../../../../docs/screenshots/issue-38',
        `${name}.png`
      ),
    });
  }
}
for (const skin of ['t3', 'telegram', 'whatsapp', 'signal']) {
  test(`${skin}: light/dark skins, accessible selection and nested reasoning`, async ({
    page,
  }, info) => {
    await open(page);
    await page.locator('#skin').selectOption(skin);
    for (const mode of ['light', 'dark']) {
      await page.locator('#mode').selectOption(mode);
      await settle(page);
      await page.locator('textarea').fill('Readable input');
      await expectAccessible(page);
      await page.locator('textarea').fill('');
      await expect(row(page, 'm9998').locator('details details')).toHaveCount(
        1
      );
      await shot(page, `${skin}-${mode}`, info);
    }
  });
}
test('five-line composer never hides the last message and publishes its exact height', async ({
  page,
}, info) => {
  await open(page);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page
    .locator('textarea')
    .fill('Line one\nLine two\nLine three\nLine four\nLine five');
  await settle(page);
  const composer = await page.locator('ui-composer').boundingBox();
  const last = await row(page, 'm9999').boundingBox();
  expect(last.y + last.height).toBeLessThanOrEqual(composer.y + 1);
  expect(
    (await page.locator('textarea').boundingBox()).height
  ).toBeGreaterThanOrEqual(120);
  const reserved = await page
    .locator('#chat-root')
    .evaluate((node) =>
      parseFloat(
        window.getComputedStyle(node).getPropertyValue('--composer-space')
      )
    );
  expect(Math.abs(reserved - composer.height)).toBeLessThanOrEqual(1);
  await shot(page, 'composer-five-lines', info);
  expect(errors).toEqual([]);
});
test('prepend keeps a measured visible anchor within 1px', async ({ page }) => {
  await open(page);
  await scroll(page).evaluate((node) => {
    node.scrollTop -= 400;
  });
  await settle(page);
  const anchor = await scroll(page).evaluate((node) => {
    const top = node.getBoundingClientRect().top;
    const row = [...node.querySelectorAll('[data-message]')].find((r) => {
      const b = r.getBoundingClientRect();
      return b.top <= top && b.bottom > top;
    });
    return { id: row.dataset.message, y: row.getBoundingClientRect().y };
  });
  await page.evaluate(() => window.chatExample.history.loadOlder());
  await settle(page);
  expect(
    Math.abs((await row(page, anchor.id).boundingBox()).y - anchor.y)
  ).toBeLessThanOrEqual(1);
  expect(await page.locator('[data-message]').count()).toBeLessThan(60);
});
test('jump highlights target and loads both ways in a bounded window', async ({
  page,
}, info) => {
  await open(page);
  await page.locator('#jump').click();
  await expect(row(page, 'm5000')).toHaveClass(/ui-chat-highlighted/);
  await settle(page);
  await shot(page, 'jump-highlight', info);
  const initial = await page.evaluate(() => window.chatExample.history.state());
  expect(initial.hasOlder).toBe(true);
  expect(initial.hasNewer).toBe(true);
  expect(initial.messages.length).toBeLessThanOrEqual(300);
  await page.getByRole('button', { name: 'Load newer', exact: true }).click();
  await settle(page);
  expect(
    await page.evaluate(
      () => window.chatExample.history.state().messages.at(-1).id
    )
  ).not.toBe(initial.messages.at(-1).id);
});
test('keyboard selection is separate from context target; false capabilities hide actions', async ({
  page,
}) => {
  await open(page);
  await row(page, 'm9999').focus();
  await page.keyboard.press('ArrowUp');
  await expect(page.locator(':focus')).toHaveAttribute('data-message', 'm9998');
  await page.keyboard.press('Space');
  await expect(row(page, 'm9998')).toHaveClass(/ui-chat-selected/);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('menuitem', { name: 'Reply', exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole('menuitem', { name: 'Edit', exact: true })
  ).toHaveCount(0);
  expect(
    await page.evaluate(() => [
      ...window.chatExample.stream.selection.state().selected,
    ])
  ).toEqual(['m9998']);
  expect(
    await page.evaluate(
      () => window.chatExample.stream.selection.state().target
    )
  ).toBe('m9999');
  await page.keyboard.press('Enter');
  await expect(page.locator('#events')).toHaveText('reply: m9999');
  await row(page, 'm9999').focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('.ui-chat-selected')).toHaveCount(0);
  await page.evaluate(() => {
    const { data } = window.chatExample;
    data.set(
      data.get().map((r) =>
        r.kind === 'chat'
          ? {
              ...r,
              'can-reply': false,
              'can-react': false,
              'can-edit': false,
            }
          : r
      )
    );
  });
  await expect(row(page, 'm9999').locator('.ui-chat-actions')).toHaveCount(0);
});
test('Enter sends; Shift+Enter and composing Enter preserve text', async ({
  page,
}) => {
  await open(page);
  const input = page.locator('textarea');
  await input.fill('Hello');
  await input.press('Shift+Enter');
  await input.press('x');
  await expect(input).toHaveValue('Hello\nx');
  await input.dispatchEvent('keydown', { key: 'Enter', isComposing: true });
  await expect(input).toHaveValue('Hello\nx');
  await input.press('Enter');
  await expect(input).toHaveValue('');
  await expect(row(page, 'm10000')).toContainText('Hello\nx');
  await settle(page);
  const last = await row(page, 'm10000').boundingBox();
  const composer = await page.locator('ui-composer').boundingBox();
  expect(last.y + last.height).toBeLessThanOrEqual(composer.y + 1);
});
test('scroll up keeps place on append; following resumes bottom tracking', async ({
  page,
}) => {
  await open(page);
  await scroll(page).evaluate((node) => {
    node.scrollTop -= 400;
  });
  await settle(page);
  const top = await scroll(page).evaluate((node) => node.scrollTop);
  await page.evaluate(async () => {
    const { messages, history } = window.chatExample;
    messages.push({ ...messages.at(-1), id: 'm10000', text: 'New arrival' });
    await history.loadNewer();
  });
  await settle(page);
  expect(
    Math.abs((await scroll(page).evaluate((node) => node.scrollTop)) - top)
  ).toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: 'Follow latest' }).click();
  await settle(page);
  await expect(row(page, 'm10000')).toBeVisible();
});
test('three styles, unread line and lifecycle cleanup', async ({ page }) => {
  await open(page);
  for (const style of ['cards', 'compact', 'bubbles']) {
    await page.locator('#style').selectOption(style);
    await settle(page);
    await expect(row(page, 'm9999')).toBeVisible();
  }
  await expect(page.locator('.ui-chat-unread')).toHaveCount(1);
  await page.evaluate(() => {
    window.chatExample.mounted.handle.destroy();
    window.chatExample.list.handle.destroy();
    window.chatExample.history.disconnect();
  });
  await expect(page.locator('ui-composer')).toHaveCount(0);
  expect(
    await page
      .locator('#chat-root')
      .evaluate((node) => node.style.getPropertyValue('--composer-space'))
  ).toBe('');
});
test('snapshot updates, trusted renderer and composer slots respect capabilities', async ({
  page,
}) => {
  await open(page);
  await page.evaluate(async () => {
    const { mountDocument } = await import('@link-foundation/ui-dom');
    const { chatVocabulary } =
      await import('/packages/ui-components/src/chat/index.js');
    const { createDataSource } =
      await import('/packages/ui-components/src/data/source.js');
    window.chatExample.mounted.handle.destroy();
    const container = document.getElementById('chat-root');
    const data = createDataSource([
      { id: 'c', kind: 'chat', 'max-attachments': 0 },
      { id: 'x', kind: 'message', chat: 'c', text: 'Initial' },
    ]);
    const slot = (text) => () => {
      const node = document.createElement('span');
      node.textContent = text;
      return node;
    };
    const mounted = mountDocument(
      container,
      's: message-stream\n  chat c\nc: composer\n  chat c',
      {
        parseOptions: { vocabulary: chatVocabulary() },
        chat: {
          data,
          clock: () => 0,
          slots: {
            message: (message) => `Rendered: ${message.text}`,
            before: slot('Before slot'),
            attachments: slot('Attachment slot'),
            after: slot('After slot'),
          },
        },
      }
    );
    window.chatSlotTest = { data, mounted };
  });
  await expect(row(page, 'x')).toContainText('Rendered: Initial');
  await expect(page.getByText('Before slot')).toBeVisible();
  await expect(page.getByText('After slot')).toBeVisible();
  await expect(page.getByText('Attachment slot')).toBeHidden();
  await page.evaluate(() => {
    window.chatSlotTest.data.set([
      { id: 'c', kind: 'chat', 'max-attachments': 2 },
      { id: 'y', kind: 'message', chat: 'c', text: 'Updated' },
    ]);
  });
  await expect(row(page, 'x')).toHaveCount(0);
  await expect(row(page, 'y')).toContainText('Rendered: Updated');
  await expect(page.getByText('Attachment slot')).toBeVisible();
  await page.evaluate(() => window.chatSlotTest.mounted.handle.destroy());
});
