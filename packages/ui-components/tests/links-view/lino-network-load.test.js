import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { defineLinoNetwork } from '../../src/links-view/lino-network.js';

for (const source of ['src="/sample.lino"', 'lino="a: hello world"']) {
  test(`upgrading connected markup with ${source} loads once`, async (t) => {
    const { window } = new JSDOM(`<lino-network ${source}></lino-network>`, {
      pretendToBeVisual: true,
    });
    t.after(() => window.close());
    const calls = [];
    const debug = [];
    defineLinoNetwork(window, {
      fetch: async (url, { signal }) => {
        calls.push({ url, signal });
        return { ok: true, text: async () => 'a: hello world' };
      },
      debug: (message, data) => debug.push({ message, data }),
    });
    const node = window.document.querySelector('lino-network');
    await node.ready;
    assert.equal(node.network.links.size, 1);
    assert.deepEqual(node.diagnostics, []);
    if (source.startsWith('src')) {
      assert.equal(calls.length, 1);
      assert.equal(calls[0].signal.aborted, false);
    }
    assert.equal(
      debug.filter(({ message }) => message === 'Loading LiNo source').length,
      1
    );
    node.setAttribute('lino', 'b: other value');
    node.removeAttribute('src');
    await node.ready;
    assert.equal(node.network.links.has('b'), true);
    node.remove();
    window.document.body.append(node);
    await node.ready;
    assert.equal(node.network.links.has('b'), true);
  });
}

test('disconnect cancels the pending load and reconnect loads again', async (t) => {
  const { window } = new JSDOM('', { pretendToBeVisual: true });
  t.after(() => window.close());
  const calls = [];
  defineLinoNetwork(window, {
    fetch: (url, { signal }) =>
      new Promise((resolve) => calls.push({ url, signal, resolve })),
  });
  const node = window.document.createElement('lino-network');
  node.setAttribute('src', '/sample.lino');
  window.document.body.append(node);
  const pending = node.ready;
  node.remove();
  assert.equal(calls[0].signal.aborted, true);
  node.setAttribute('src', '/new.lino');
  assert.equal(calls.length, 1);
  window.document.body.append(node);
  assert.equal(calls.length, 2);
  const response = (text) => ({ ok: true, text: async () => text });
  calls[1].resolve(response('new: hello world'));
  await node.ready;
  calls[0].resolve(response('old: stale source'));
  await pending;
  assert.equal(node.network.links.has('new'), true);
  assert.equal(node.network.links.has('old'), false);
});
