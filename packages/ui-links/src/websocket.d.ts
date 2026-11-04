import type { Transport } from '@link-foundation/ui-links';

/** Native WebSocket transport. Binary mode uses links-notation packets. */
export function connectWebSocket(
  url: string | URL,
  options?: { binary?: boolean }
): Promise<Transport & { close(): Promise<void> }>;
