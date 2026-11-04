import { it } from 'test-anywhere';

it('runs the WebSocket twin of the TCP example (text and binary)', async () => {
  await import('../examples/ui-links-websocket.mjs');
});
