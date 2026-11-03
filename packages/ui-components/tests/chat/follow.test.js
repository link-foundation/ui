import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import {
  createFollow,
  firstUnread,
  anchorScrollTop,
} from '../../src/chat/follow.js';
import { listOffsets } from '../../src/data/virtual-range.js';
test('follows only at bottom, pauses for user scroll, resumes explicitly, cleans listeners', () => {
  const dom = new JSDOM('<div></div>');
  const root = dom.window.document.querySelector('div');
  Object.defineProperties(root, {
    scrollHeight: { value: 1000, configurable: true },
    clientHeight: { value: 200 },
  });
  const follow = createFollow(root);
  follow.refresh();
  assert.equal(root.scrollTop, 1000);
  root.scrollTop = 400;
  root.dispatchEvent(new dom.window.Event('scroll'));
  follow.refresh();
  assert.equal(root.scrollTop, 400);
  follow.toBottom();
  assert.equal(root.scrollTop, 1000);
  root.dispatchEvent(new dom.window.WheelEvent('wheel', { deltaY: -1 }));
  assert.equal(follow.state().following, false);
  follow.disconnect();
  dom.window.close();
});
test('keyed prepend anchor includes intra-row offset and unread ignores outgoing', () => {
  const before = {
    keys: ['a', 'b'],
    offsets: listOffsets({ count: 2, estimate: 20 }),
    scrollTop: 25,
  };
  const after = {
    keys: ['x', 'a', 'b'],
    offsets: listOffsets({ count: 3, estimate: 20 }),
  };
  assert.equal(anchorScrollTop(before, after, 'b'), 45);
  assert.equal(
    firstUnread([
      { id: 'a', unread: true, outgoing: true },
      { id: 'b', unread: true },
    ]),
    'b'
  );
});
