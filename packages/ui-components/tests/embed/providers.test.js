import { describe, it, expect } from 'test-anywhere';
import { xProvider } from '../../src/embed/providers/x.js';
import { telegramProvider } from '../../src/embed/providers/telegram.js';
import { vkProvider } from '../../src/embed/providers/vk.js';
import { fixture, microtasks } from './support.js';

const context = { theme: 'dark', locale: 'ru' };
describe('optional official provider adapters', () => {
  it('validates all URL parts, including the required VK hash', () => {
    for (const adapter of [xProvider, telegramProvider, vkProvider]) {
      for (const id of [
        '42&x=1',
        '//host',
        '42\n',
        '<script>',
        '',
        '1/2?evil',
      ]) {
        expect(adapter.validate({ id, hash: 'abc123' })).toBe(false);
      }
    }
    expect(xProvider.validate({ id: '42' })).toBe(true);
    expect(telegramProvider.validate({ id: 'channel/42' })).toBe(true);
    expect(vkProvider.validate({ id: '-42_123', hash: '' })).toBe(false);
    expect(vkProvider.validate({ id: '-42_123', hash: 'abc&x=1' })).toBe(false);
    expect(vkProvider.validate({ id: '-42_123', hash: 'abc123' })).toBe(true);
    expect(telegramProvider.url({ id: 'channel/42' }, context)).toBe(
      'https://t.me/channel/42?embed=1&dark=1&lang=ru'
    );
    expect(vkProvider.url({ id: '-42_123', hash: 'abc123' }, context)).toBe(
      'https://vk.com/widget_post.php?owner_id=-42&post_id=123&hash=abc123'
    );
  });

  it('passes privacy, theme and language to X and handles unavailable posts', async () => {
    const t = fixture({ ...xProvider, script: null });
    const calls = [];
    t.window.twttr = {
      widgets: {
        createTweet: (...args) => {
          calls.push(args);
          return Promise.resolve(undefined);
        },
      },
    };
    t.enter();
    await microtasks();
    expect(calls[0][2]).toEqual({ theme: 'light', lang: 'en', dnt: true });
    expect(t.errors.map((error) => error.reason)).toEqual(['unavailable']);
    t.destroy();
  });

  it('uses VK readiness and releases its widget RPC endpoint', async () => {
    const calls = [];
    let cleaned = 0;
    const t = fixture(
      { ...vkProvider, script: null },
      { id: '-42_123', hash: 'abc' }
    );
    t.window.VK = {
      Widgets: {
        Post: (...args) => {
          calls.push(args);
          args[4].onReady();
          return 7;
        },
        RPC: {
          7: {
            destroy: () => {
              cleaned++;
            },
          },
        },
      },
    };
    t.enter();
    await microtasks();
    expect(calls[0].slice(1, 4)).toEqual(['-42', '123', 'abc']);
    expect(t.host.dataset.state).toBe('ready');
    t.controller.destroy();
    expect(cleaned).toBe(1);
    expect(t.window.VK.Widgets.RPC[7]).toBe(undefined);
    t.destroy();
  });

  it('uses the official Telegram frame without installing a parent message handler', async () => {
    const t = fixture(telegramProvider, { id: 'channel/42' });
    t.enter();
    await microtasks();
    const frame = t.host.querySelector('iframe');
    expect(frame.src).toBe('https://t.me/channel/42?embed=1&dark=0&lang=en');
    expect(t.host.dataset.state).toBe('loading');
    frame.dispatchEvent(new t.window.Event('load'));
    expect(t.host.dataset.state).toBe('ready');
    t.destroy();
  });
});
