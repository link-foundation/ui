import { createDom, microtasks } from '../support/dom.js';
import { createEmbed } from '../../src/embed/controller.js';
import { registerEmbedProvider } from '../../src/embed/registry.js';
export { microtasks };

/** Finite manual clock and viewport; provider/network events are explicit. */
export function fixture(overrides = {}, options = {}) {
  const { window, document, container: host } = createDom();
  const timers = new Map(),
    observers = [];
  let serial = 0;
  window.setTimeout = (fn, delay) => {
    const id = ++serial;
    timers.set(id, { fn, delay });
    return id;
  };
  window.clearTimeout = (id) => timers.delete(id);
  class Intersection {
    constructor(fn, init) {
      this.fn = fn;
      this.options = init;
      observers.push(this);
    }
    observe() {
      this.active = true;
    }
    disconnect() {
      this.active = false;
    }
    enter() {
      this.fn([{ isIntersecting: true }]);
    }
  }
  if (!options.immediate) {
    window.IntersectionObserver = Intersection;
  }
  const renders = [],
    logs = [],
    errors = [];
  const remove = registerEmbedProvider('test', {
    script: 'https://example.com/widget.js',
    validate: ({ id }) => /^[0-9]+$/.test(id),
    url: ({ id }) => `https://example.com/post/${id}`,
    render: (node, context) => {
      renders.push({ node, context });
    },
    ...overrides,
  });
  host.innerHTML = '<article slot="fallback"><p>Archived post</p></article>';
  host.addEventListener('ui-embed-error', (event) => errors.push(event.detail));
  const controller = createEmbed(host, {
    provider: 'test',
    id: '42',
    log: (...args) => logs.push(args),
    ...options,
  });
  return {
    window,
    document,
    host,
    timers,
    observers,
    renders,
    logs,
    errors,
    controller,
    enter() {
      observers[0].enter();
    },
    script(ok = true) {
      document.scripts[0].dispatchEvent(
        new window.Event(ok ? 'load' : 'error')
      );
    },
    expire(delay) {
      for (const [id, timer] of [...timers]) {
        if (timer.delay === delay) {
          timers.delete(id);
          timer.fn();
        }
      }
    },
    destroy() {
      controller.destroy();
      remove();
      window.close();
    },
  };
}
