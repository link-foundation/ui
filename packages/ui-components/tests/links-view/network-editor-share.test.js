import { it } from 'node:test';
import assert from 'node:assert/strict';
import { createDom } from '../support/dom.js';
import {
  createNetworkShare,
  networkFilename,
  networkShareTargets,
} from '../../src/links-view/network-editor/share.js';
import { normalize } from '../../src/links-view/network-editor/options.js';

it('uses safe bounded filenames and encodes every share target', () => {
  assert.equal(
    networkFilename('11 22 12', 'png'),
    'links-network-11-22-12.png'
  );
  assert.equal(networkFilename('1'.repeat(500), 'lino').length, 160);
  const targets = networkShareTargets(
    'https://example.test/?code=01 20&color=#123456'
  );
  assert.equal(Object.keys(targets).length, 10);
  for (const href of Object.values(targets)) {
    assert.ok(
      href.includes(
        encodeURIComponent('https://example.test/?code=01 20&color=#123456')
      )
    );
  }
});
it('prepares Web Share PNG after 200 ms, rejects stale preparation, and falls back to URL sharing', async () => {
  const { window, document, container } = createDom();
  const jobs = new Map();
  let job = 0;
  let now = 0;
  window.setTimeout = (fn, delay) => {
    jobs.set(++job, { fn, time: now + delay });
    return job;
  };
  window.clearTimeout = (id) => jobs.delete(id);
  const tick = (ms) => {
    now += ms;
    for (const [id, item] of jobs) {
      if (item.time <= now) {
        jobs.delete(id);
        item.fn();
      }
    }
  };
  let code = '11',
    renders = 0;
  const pending = [];
  const shares = [];
  window.navigator.canShare = () => true;
  window.navigator.share = (payload) => {
    shares.push(payload);
    return payload.files
      ? Promise.reject(new Error('files unsupported'))
      : Promise.resolve();
  };
  const panel = createNetworkShare(container, {
    window,
    presentation: {
      toRaster: () => {
        renders++;
        return new Promise((resolve) => pending.push(resolve));
      },
    },
    getState: () => ({ code, links: [[1, 1]], options: normalize({}) }),
    getUrl: () => `https://example.test/?code=${code}`,
    announce() {},
  });
  panel.refresh();
  tick(199);
  await Promise.resolve();
  assert.equal(renders, 0);
  tick(1);
  await Promise.resolve();
  assert.equal(renders, 1);
  code = '00';
  panel.refresh();
  pending[0](new window.Blob(['old'], { type: 'image/png' }));
  await Promise.resolve();
  tick(200);
  await Promise.resolve();
  pending[1](new window.Blob(['new'], { type: 'image/png' }));
  for (let i = 0; i < 8; i++) {
    await Promise.resolve();
  }
  [...document.querySelectorAll('button')]
    .find((node) => node.textContent === 'Share')
    .click();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(shares[0].files[0].name, 'links-network-00.png');
  assert.equal(shares[1].url, 'https://example.test/?code=00');
  assert.equal(shares[1].files, undefined);
  panel.dispose();
  window.close();
});
