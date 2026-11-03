import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  summarizeChats,
  sortChats,
  unreadCount,
  deliveryStatus,
  dayGroup,
  dayLabel,
  messageRuns,
} from '../../src/chat/chat-model.js';
const options = {
  clock: () => Date.parse('2026-10-30T12:00Z'),
  locale: 'en',
  labels: { today: 'Today', yesterday: 'Yesterday' },
};
test('summaries, stable sorting, pinned order and unread filtering', () => {
  const data = [
    { id: 'c', kind: 'chat' },
    { id: 'empty', kind: 'chat', pinned: 1 },
    {
      id: 'm',
      kind: 'message',
      chat: 'c',
      unread: true,
      time: '2026-10-30T10:00Z',
    },
  ];
  const chats = summarizeChats(data);
  assert.equal(chats[0].id, 'empty');
  assert.equal(chats[1].unread, 1);
  assert.equal(summarizeChats(data, { filter: 'unread' }).length, 1);
  assert.equal(sortChats(chats, 'oldest')[0].id, 'empty');
  assert.equal(unreadCount([], { unread: 7 }), 7);
  assert.equal(unreadCount([{ unread: true, outgoing: true }]), 0);
});
test('delivery remains explicit including pending, failed, delivered and read', () => {
  assert.equal(deliveryStatus({}), null);
  for (const status of ['pending', 'failed', 'delivered', 'read']) {
    assert.equal(deliveryStatus({ outgoing: true, status }), status);
  }
});
test('day groups, locale, time zone and injected clock', () => {
  for (const [iso, group] of [
    ['2026-10-30T00:00Z', 'today'],
    ['2026-10-29T00:00Z', 'yesterday'],
    ['2026-10-25T00:00Z', 'week'],
    ['2026-10-01T00:00Z', 'older'],
    ['invalid', 'older'],
  ]) {
    assert.equal(dayGroup(iso, options), group);
  }
  assert.equal(dayLabel('2026-10-30T00:00Z', options), 'Today');
  assert.equal(dayLabel('2026-10-01T00:00Z', options), 'Oct 1, 2026');
  assert.equal(
    dayGroup('2026-10-30T01:00Z', { ...options, timeZone: 'America/New_York' }),
    'yesterday'
  );
});
test('sender runs break on sender, date, time gap and service lines', () => {
  const m = (id, sender, time, service = false) => ({
    id,
    sender,
    time,
    service,
  });
  const runs = messageRuns([
    m('1', 'a', '2026-10-29T23:59Z'),
    m('2', 'a', '2026-10-30T00:00Z'),
    m('3', 'a', '2026-10-30T00:01Z'),
    m('4', 'b', '2026-10-30T00:02Z'),
    m('5', 'b', '2026-10-30T00:03Z', true),
    m('6', 'b', '2026-10-30T00:04Z'),
    m('7', 'b', '2026-10-30T01:00Z'),
  ]);
  assert.deepEqual(
    runs.map((r) => r.messages.length),
    [1, 2, 1, 1, 1, 1]
  );
});
