import { describe, it, expect } from 'test-anywhere';
import { fixture, microtasks } from './support.js';
import { createEmbed } from '../../src/embed/controller.js';

describe('embed resource ownership', () => {
  it('retains a shared pending script across a theme switch and another host unmount', async () => {
    const t = fixture();
    t.enter();
    const script = t.document.scripts[0];
    const other = t.document.createElement('div');
    t.document.body.append(other);
    const second = createEmbed(other, { provider: 'test', id: '43' });
    t.observers[1].enter();
    t.document.documentElement.dataset.scheme = 'dark';
    await microtasks();
    second.destroy();
    expect(t.document.scripts.length).toBe(1);
    expect(t.document.scripts[0]).toBe(script);
    t.script();
    await microtasks();
    expect(t.renders.length).toBe(1);
    expect(t.renders[0].context.theme).toBe('dark');
    t.destroy();
  });

  it('cleans frame resize observers and provider cleanup exactly once', async () => {
    let observer,
      cleaned = 0;
    const t = fixture({
      script: null,
      render: (node, context) => {
        t.renders.push({ node, context });
        return () => {
          cleaned++;
        };
      },
    });
    t.window.ResizeObserver = class {
      constructor(callback) {
        observer = this;
        this.callback = callback;
        this.active = true;
      }
      observe() {}
      disconnect() {
        this.active = false;
      }
    };
    t.enter();
    await microtasks();
    const frame = t.document.createElement('iframe');
    let height = 0;
    frame.getBoundingClientRect = () => ({ height });
    t.renders[0].node.append(frame);
    await microtasks();
    expect(t.host.dataset.state).toBe('loading');
    height = 80;
    observer.callback();
    expect(t.host.dataset.state).toBe('ready');
    t.controller.destroy();
    t.controller.destroy();
    expect(observer.active).toBe(false);
    expect(cleaned).toBe(1);
    expect(t.timers.size).toBe(0);
    t.destroy();
  });

  it('rejects unsafe provider output before scripts and catches thrown adapters', async () => {
    const t = fixture({ url: () => 'javascript:alert(1)' });
    t.enter();
    expect(t.document.scripts.length).toBe(0);
    expect(t.host.dataset.state).toBe('fallback');
    t.destroy();
    const broken = fixture({
      script: null,
      render: () => {
        throw new Error('SDK failed');
      },
    });
    broken.enter();
    await microtasks();
    expect(broken.errors.map((error) => error.reason)).toEqual([
      'provider-error',
    ]);
    broken.destroy();
  });

  it('can report a post unavailable after an iframe initially became ready', async () => {
    const t = fixture({ script: null });
    t.enter();
    await microtasks();
    t.renders[0].context.ready();
    t.renders[0].context.unavailable();
    t.renders[0].context.unavailable();
    expect(t.errors.map((error) => error.reason)).toEqual(['unavailable']);
    expect(t.host.dataset.state).toBe('fallback');
    t.destroy();
  });
});
