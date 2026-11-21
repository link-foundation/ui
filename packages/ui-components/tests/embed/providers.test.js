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
    const t = fixture(
      { ...xProvider, script: null },
      { widgetOptions: { x: { width: 550, align: 'center', dnt: false } } }
    );
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
    expect(calls[0][2]).toEqual({
      width: 550,
      align: 'center',
      theme: 'light',
      lang: 'en',
      dnt: true,
    });
    expect(t.errors.map((error) => error.reason)).toEqual(['unavailable']);
    t.destroy();
  });

  it('uses VK readiness and releases its widget RPC endpoint', async () => {
    const calls = [];
    let cleaned = 0;
    const t = fixture(
      { ...vkProvider, script: null },
      {
        id: '-42_123',
        hash: 'abc',
        widgetOptions: { vk: { width: '100%' } },
      }
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
    expect(calls[0][4].width).toBe('100%');
    expect(t.host.dataset.state).toBe('ready');
    t.controller.destroy();
    expect(cleaned).toBe(1);
    expect(t.window.VK.Widgets.RPC[7]).toBe(undefined);
    t.destroy();
  });
});

describe('official Telegram post widget', () => {
  it('waits for the Telegram SDK to size the frame and follows later resizes', async () => {
    const t = fixture(telegramProvider, { id: 'channel/42' });
    t.enter();
    await microtasks();
    const widget = t.host.querySelector('iframe');
    const doc = widget.contentDocument;
    const script = doc.querySelector('script');
    expect(doc.querySelector('blockquote').dataset.telegramPost).toBe(
      'channel/42'
    );
    const frame = doc.createElement('iframe');
    doc.body.prepend(frame);
    script.dispatchEvent(new widget.contentWindow.Event('load'));
    await microtasks();
    widget.dispatchEvent(new t.window.Event('load'));
    frame.dispatchEvent(new widget.contentWindow.Event('load'));
    expect(t.host.dataset.state).toBe('loading');
    frame.style.height = '125px';
    await microtasks();
    expect(t.host.dataset.state).toBe('ready');
    expect(widget.style.height).toBe('125px');
    frame.style.height = '940px';
    await microtasks();
    expect(widget.style.height).toBe('940px');
    t.controller.update({ id: 'channel/43', locale: 'ru', theme: 'dark' });
    await microtasks();
    expect(widget.isConnected).toBe(false);
    expect(t.host.querySelectorAll('iframe').length).toBe(1);
    const replacement = t.host.querySelector('iframe').contentDocument;
    expect(replacement.documentElement.lang).toBe('ru');
    const { telegramPost, dark } =
      replacement.querySelector('blockquote').dataset;
    expect([telegramPost, dark]).toEqual(['channel/43', '1']);
    expect(t.host.dataset.state).toBe('loading');
    t.destroy();
  });

  it('aborts old Telegram availability checks and falls back when a post is missing', async () => {
    const checks = [];
    const t = fixture(telegramProvider, {
      id: 'channel/42',
      widgetOptions: {
        telegram: {
          checkAvailability: (context) =>
            new Promise((resolve) => checks.push({ ...context, resolve })),
        },
      },
    });
    t.enter();
    await microtasks();
    for (const patch of [
      { locale: 'ru' },
      { theme: 'dark' },
      { id: 'channel/43' },
    ]) {
      t.controller.update(patch);
      await microtasks();
    }
    expect(checks.map(({ signal }) => signal.aborted)).toEqual([
      true,
      true,
      true,
      false,
    ]);
    for (const check of checks.slice(0, -1)) {
      check.resolve(true);
    }
    expect(checks[3].url).toBe(
      'https://t.me/channel/43?embed=1&dark=1&lang=ru'
    );
    checks[3].resolve(false);
    await microtasks();
    expect(t.host.querySelector('iframe')).toBe(null);
    expect(t.host.dataset.state).toBe('fallback');
    expect(t.errors.map(({ reason }) => reason)).toEqual(['unavailable']);
    t.destroy();
  });
});
