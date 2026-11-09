import { it } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { observeFrameFit } from '../src/frame-fit.js';

it('allocates one observer only with limits, tracks new hosts, deduplicates markers and disposes', async () => {
  const dom = new JSDOM('<html><body><div class="panel"></div></body></html>');
  const { document } = dom.window;
  const scope = document.documentElement;
  let created = 0,
    disconnected = 0,
    writes = 0;
  const observed = new Set();
  let deliver;
  class Resize {
    constructor(callback) {
      created++;
      deliver = callback;
    }
    observe(element) {
      observed.add(element);
    }
    unobserve(element) {
      observed.delete(element);
    }
    disconnect() {
      disconnected++;
      observed.clear();
    }
  }
  const handle = observeFrameFit(document, {
    levels: { panel: ['.panel'] },
    ResizeObserver: Resize,
  });
  assert.equal(created, 0);
  scope.style.setProperty('--frame-panel-min-width', '50');
  await new Promise((resolve) => dom.window.queueMicrotask(resolve));
  assert.equal(created, 1);
  const panel = document.querySelector('.panel');
  assert.equal(panel.getAttribute('data-frame-fit'), 'outside');
  const set = panel.setAttribute.bind(panel);
  panel.setAttribute = (...args) => {
    writes++;
    set(...args);
  };
  deliver([
    { target: panel, borderBoxSize: [{ inlineSize: 10, blockSize: 10 }] },
  ]);
  deliver([
    { target: panel, borderBoxSize: [{ inlineSize: 10, blockSize: 10 }] },
  ]);
  assert.equal(writes, 0);
  deliver([
    { target: panel, borderBoxSize: [{ inlineSize: 100, blockSize: 10 }] },
  ]);
  assert.equal(panel.hasAttribute('data-frame-fit'), false);
  const child = document.createElement('div');
  child.className = 'panel';
  document.body.append(child);
  await new Promise((resolve) => dom.window.queueMicrotask(resolve));
  assert.ok(observed.has(child));
  scope.style.setProperty('--frame-panel-min-width', '0');
  await new Promise((resolve) => dom.window.queueMicrotask(resolve));
  assert.equal(disconnected, 1);
  assert.equal(observed.size, 0);
  assert.equal(child.hasAttribute('data-frame-fit'), false);
  handle.dispose();
  handle.dispose();
  dom.window.close();
});

it('uses block limits for nested panels and restarts at a boundary', () => {
  const dom = new JSDOM(`<html><body><div class="panel" id="outer">
    <div class="panel" id="inner"></div>
    <div data-preview><div class="panel" id="preview"></div></div>
  </div></body></html>`);
  const { document } = dom.window;
  document.documentElement.style.setProperty('--frame-block-min-width', '50');
  const observed = new Set();
  class Resize {
    observe(element) {
      observed.add(element);
    }
    unobserve(element) {
      observed.delete(element);
    }
    disconnect() {
      observed.clear();
    }
  }
  const handle = observeFrameFit(document, {
    levels: { panel: ['.panel'], block: ['.block'] },
    boundaryAttribute: 'data-preview',
    ResizeObserver: Resize,
  });
  assert.deepEqual(
    [...observed].map((el) => el.id),
    ['inner']
  );
  assert.equal(
    document.querySelector('#inner').getAttribute('data-frame-fit'),
    'outside'
  );
  assert.equal(
    document.querySelector('#preview').hasAttribute('data-frame-fit'),
    false
  );
  handle.dispose();
  assert.equal(observed.size, 0);
  dom.window.close();
});
