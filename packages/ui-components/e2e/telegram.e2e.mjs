import { URL } from 'node:url';
import { expect, test } from '@playwright/test';
import { expectAccessible } from '../../../tests/ui/helpers.mjs';

const sdkUrl = 'https://telegram.org/js/telegram-widget.js?24';
const sdkFixture = `(() => {
  const post = document.querySelector('blockquote.telegram-post');
  const frame = document.createElement('iframe');
  frame.src = 'https://t.me/' + post.dataset.telegramPost + '?embed=1';
  frame.width = '100%';
  post.replaceWith(frame);
  window.addEventListener('message', (event) => {
    if (event.source === frame.contentWindow && event.origin === 'https://t.me') {
      frame.style.height = JSON.parse(event.data).height + 'px';
    }
  });
})();`;

async function mount(page) {
  await page.goto('/packages/ui-components/examples/embed.html?id=invalid');
  await page.evaluate(async () => {
    const { createEmbed } = await import('../src/embed/index.js');
    await import('../src/embed/providers/telegram.js');
    document.querySelector('main').innerHTML = `
      <h1>Telegram posts</h1>
      <div id="short"></div>
      <div id="long"></div>
      <article id="archive" hidden>
        <h2>Saved copy</h2>
        <button type="button">Try again</button>
      </article>`;
    const archive = document.querySelector('#archive');
    createEmbed(document.querySelector('#short'), {
      provider: 'telegram',
      id: 'channel/42',
      timeout: 3000,
      labels: { title: 'Short post' },
    });
    const long = createEmbed(document.querySelector('#long'), {
      provider: 'telegram',
      id: 'channel/43',
      timeout: 3000,
      archive,
      labels: { title: 'Long post' },
      widgetOptions: {
        telegram: { checkAvailability: ({ id }) => id !== 'channel/99' },
      },
    });
    archive.querySelector('button').onclick = () => long.retry();
    window.updatePost = (patch) => long.update(patch);
  });
}

test('Telegram follows widget sizes for short and long posts and preserves focus using a host archive', async ({
  page,
}) => {
  const requests = [];
  await page.route(sdkUrl, (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: sdkFixture,
    })
  );
  await page.route('https://t.me/channel/**', (route) => {
    const post = new URL(route.request().url()).pathname;
    requests.push(post);
    const height = post.endsWith('/42') ? 120 : 740;
    return route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html lang="en"><title>Post fixture</title><p>Sample post</p>
        <script>
          const size = () => parent.postMessage(JSON.stringify({
            height: innerWidth < 350 ? ${height + 80} : ${height}
          }), '*');
          addEventListener('resize', size);
          size();
        </script>`,
    });
  });
  await mount(page);
  const short = page.locator('#short');
  const long = page.locator('#long');
  await expect(short).toHaveAttribute('data-state', 'ready');
  await expect(long).toHaveAttribute('data-state', 'ready');
  await expect(short.locator('iframe')).toHaveCSS('height', '120px');
  await expect(long.locator('iframe')).toHaveCSS('height', '740px');
  await page.setViewportSize({ width: 320, height: 800 });
  await expect(short.locator('iframe')).toHaveCSS('height', '200px');
  await expect(long.locator('iframe')).toHaveCSS('height', '820px');
  await expectAccessible(page);

  const frame = long.locator('iframe');
  await frame.focus();
  await expect(frame).toBeFocused();
  await page.evaluate(() => window.updatePost({ id: 'channel/99' }));
  await expect(long).toHaveAttribute('data-state', 'fallback');
  const archive = page.locator('#archive');
  await expect(archive).toBeFocused();
  await expect(archive).toBeVisible();
  await expect(long.locator('details, button, iframe')).toHaveCount(0);
  expect(requests).toEqual(
    expect.arrayContaining(['/channel/42', '/channel/43'])
  );
  expect(requests).not.toContain('/channel/99');
  await expectAccessible(page);

  await page.getByRole('button', { name: 'Try again' }).focus();
  await page.keyboard.press('Enter');
  await expect(archive).toBeFocused();
  await expect(archive).toBeVisible();
});

test('a blocked Telegram iframe load times out into the archive', async ({
  page,
}) => {
  await page.route(sdkUrl, (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: sdkFixture,
    })
  );
  await page.route('https://t.me/channel/**', (route) => route.abort());
  await mount(page);
  const long = page.locator('#long');
  await page.evaluate(() => window.updatePost({ timeout: 500 }));
  await expect(long).toHaveAttribute('data-state', 'fallback');
  await expect(long.locator('iframe')).toHaveCount(0);
  await expect(page.locator('#archive')).toBeVisible();
});
