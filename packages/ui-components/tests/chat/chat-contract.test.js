import { URL } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { parseChatData, chatDataToLino } from '../../src/chat/chat-contract.js';

for (const name of readdirSync(new URL('./fixtures/', import.meta.url))) {
  test(`contract round trip: ${name}`, () => {
    const text = readFileSync(
      new URL(`./fixtures/${name}`, import.meta.url),
      'utf8'
    );
    const data = parseChatData(text);
    assert.deepEqual(parseChatData(chatDataToLino(data)), data);
    assert.equal(data[0]['can-edit'], false);
    assert.equal(data[0]['max-attachments'], 2);
  });
}
test('rejects duplicate identities, duplicate fields and invalid typed values', () => {
  for (const text of [
    'a: chat\na: message',
    'a: chat (unread nope)',
    'a: chat (can-edit yes)',
    'a: chat (title a) (title b)',
  ]) {
    assert.throws(() => parseChatData(text));
  }
});
test('official parser raw values accepted; literal numeric text and quotes survive', () => {
  const data = [
    { id: 'x', kind: 'message', text: "001 'hello'\n(world)", outgoing: true },
  ];
  assert.deepEqual(parseChatData(chatDataToLino(data)), data);
});
