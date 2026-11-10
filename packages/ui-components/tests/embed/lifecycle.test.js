import { describe, it, expect } from 'test-anywhere';
import { fixture, microtasks } from './support.js';
import { createEmbed } from '../../src/embed/controller.js';

describe('deferred embed lifecycle', () => {
  it('defers until the 400px viewport margin and shares scripts between hosts', async () => {
    const t = fixture();
    expect(t.document.scripts.length).toBe(0);
    expect(t.observers[0].options.rootMargin).toBe('400px');
    t.enter();
    const other = t.document.createElement('div');
    t.document.body.append(other);
    const second = createEmbed(other, { provider: 'test', id: '43' });
    t.observers[1].enter();
    expect(t.document.scripts.length).toBe(1);
    t.script();
    await microtasks();
    expect(t.renders.length).toBe(2);
    second.destroy();
    t.destroy();
    expect(t.timers.size).toBe(0);
  });

  it('starts immediately without IntersectionObserver', async () => {
    const t = fixture({ script: null }, { immediate: true });
    await microtasks();
    expect(t.renders.length).toBe(1);
    t.renders[0].context.ready();
    expect(t.host.hasAttribute('data-loaded')).toBe(true);
    t.destroy();
  });

  it('emits one error when a post never renders and shows the archive directly', async () => {
    const t = fixture({}, { debug: true, toggle: true });
    t.enter();
    t.script();
    await microtasks();
    t.expire(12000);
    t.renders[0].context.unavailable();
    t.renders[0].context.ready();
    expect(t.errors.map((e) => e.reason)).toEqual(['timeout']);
    expect(t.host.dataset.state).toBe('fallback');
    expect(t.host.querySelector('[slot="fallback"]').parentNode).toBe(t.host);
    expect(t.host.querySelector('[data-part="embed"]').childNodes.length).toBe(
      0
    );
    expect(t.logs.map((args) => args[1].state)).toEqual([
      'deferred',
      'loading',
      'fallback',
    ]);
    t.host.querySelector('button').click();
    await microtasks();
    expect(t.host.dataset.state).toBe('loading');
    t.renders[1].context.ready();
    expect(t.host.querySelector('details [slot="fallback"]') !== null).toBe(
      true
    );
    t.host.querySelector('button').click();
    expect(t.host.dataset.state).toBe('off');
    t.destroy();
  });

  it('retries script failures and timeouts with a new request', async () => {
    const t = fixture();
    t.enter();
    t.script(false);
    await microtasks();
    expect(t.host.dataset.state).toBe('fallback');
    expect(t.document.scripts.length).toBe(0);
    t.controller.retry();
    expect(t.document.scripts.length).toBe(1);
    t.expire(10000);
    await microtasks();
    expect(t.document.scripts.length).toBe(0);
    t.controller.retry();
    t.script();
    await microtasks();
    t.renders[0].context.ready();
    expect(t.host.dataset.state).toBe('ready');
    t.destroy();
  });

  it('rejects invalid ids and unknown providers before any network request', () => {
    const t = fixture();
    t.enter();
    t.controller.update({ id: '42&x=1' });
    expect(t.document.scripts.length).toBe(0);
    expect(t.host.dataset.state).toBe('fallback');
    t.controller.update({ id: '//host' });
    t.controller.update({ provider: 'unknown' });
    expect(t.document.querySelector('iframe')).toBe(null);
    expect(t.document.scripts.length).toBe(0);
    t.destroy();
  });
});

describe('embed generations and cleanup', () => {
  it('discards late results after theme and locale changes into fresh containers', async () => {
    let resolveOld,
      cleaned = 0;
    const t = fixture({
      script: null,
      render: (node, context) => {
        t.renders.push({ node, context });
        if (t.renders.length === 1) {
          return new Promise((resolve) => {
            resolveOld = resolve;
          });
        }
      },
    });
    t.enter();
    await microtasks();
    const old = t.renders[0];
    t.document.documentElement.setAttribute('data-scheme', 'dark');
    t.document.documentElement.lang = 'ru';
    await microtasks();
    const next = t.renders[1];
    expect(next.context.theme).toBe('dark');
    expect(next.context.locale).toBe('ru');
    next.node.textContent = 'New widget';
    old.node.textContent = 'Late old widget';
    old.context.ready();
    resolveOld(() => {
      cleaned++;
    });
    await microtasks();
    expect(old.context.signal.aborted).toBe(true);
    expect(cleaned).toBe(1);
    expect(t.host.querySelector('[data-part="embed"]').textContent).toBe(
      'New widget'
    );
    expect(t.host.querySelector('[data-part="embed"]').childNodes.length).toBe(
      1
    );
    next.context.ready();
    expect(t.host.dataset.state).toBe('ready');
    t.destroy();
  });

  it('titles and detects a positive-height iframe without reading its document', async () => {
    const t = fixture({ script: null }, { locale: 'ru' });
    t.enter();
    await microtasks();
    const frame = t.document.createElement('iframe');
    Object.defineProperty(frame, 'offsetHeight', { value: 100 });
    Object.defineProperty(frame, 'contentDocument', {
      get() {
        throw new Error('Cross-origin read');
      },
    });
    t.renders[0].node.append(frame);
    await microtasks();
    expect(frame.title).toBe('Встроенная публикация');
    expect(t.host.dataset.state).toBe('ready');
    t.window.dispatchEvent(
      new t.window.MessageEvent('message', {
        data: { height: 99999 },
        origin: 'https://evil.example',
      })
    );
    expect(frame.style.height).toBe('');
    t.destroy();
  });

  it('unmount cancels timers, viewport and context observers, container and pending script', async () => {
    const t = fixture();
    t.enter();
    t.controller.destroy();
    expect(t.timers.size).toBe(0);
    expect(t.document.scripts.length).toBe(0);
    expect(t.host.querySelector('[data-part="embed"]')).toBe(null);
    expect(t.observers[0].active).toBe(false);
    t.document.documentElement.lang = 'ru';
    await microtasks();
    expect(t.renders.length).toBe(0);
    expect(t.errors.length).toBe(0);
    t.destroy();
  });
});
