import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createViewport } from '../../src/data/viewport.js';

test('one observer defers measurements to a frame, preserves anchor, and disconnects', () => {
  const dom = new JSDOM('<div id="root"><div id="body"></div></div>', {
    pretendToBeVisual: true,
  });
  const { window } = dom;
  const root = window.document.getElementById('root');
  const body = window.document.getElementById('body');
  Object.defineProperty(root, 'clientHeight', { value: 40 });
  let callback;
  let instances = 0;
  let disconnected = false;
  const observed = new Set();
  window.ResizeObserver = class {
    constructor(fn) {
      callback = fn;
      instances++;
    }
    observe(node) {
      observed.add(node);
    }
    unobserve(node) {
      observed.delete(node);
    }
    disconnect() {
      disconnected = true;
      observed.clear();
    }
  };
  let frame;
  window.requestAnimationFrame = (fn) => {
    frame = fn;
    return 1;
  };
  window.cancelAnimationFrame = () => {
    frame = null;
  };
  const view = createViewport(root, body, {
    estimate: 20,
    draw: (row, item) => {
      row.textContent = item.label;
      row.tabIndex = 0;
    },
  });
  view.setItems(
    Array.from({ length: 1000 }, (_, i) => ({
      id: String(i),
      label: `Row ${i}`,
    }))
  );
  root.scrollTop = 25;
  callback([{ target: view.row('0'), borderBoxSize: [{ blockSize: 30 }] }]);
  assert.equal(root.scrollTop, 25, 'observer does not write synchronously');
  const measure = frame;
  frame = null;
  measure();
  assert.equal(root.scrollTop, 35, 'row 1 retains its intra-row offset');
  assert.equal(instances, 1);
  assert.ok(observed.size < 20);
  view.row('1').focus();
  root.scrollTop = 1000;
  view.render();
  assert.equal(window.document.activeElement, view.row('1'));
  assert.ok(body.children.length < 20);
  callback([{ target: root }]);
  view.disconnect();
  assert.equal(disconnected, true);
  assert.equal(frame, null);
  dom.window.close();
});
