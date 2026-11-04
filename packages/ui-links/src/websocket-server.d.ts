import type { LinksServer } from '@link-foundation/ui-links';

/** Node.js server. Replies and pushes follow the last request's frame type. */
export function listenLinksWebSocket(
  server: LinksServer,
  options?: {
    port?: number;
    host?: string;
    maxMessageBytes?: number;
    subject?: number | null;
  }
): Promise<{
  port: number;
  host: string;
  address: string;
  url: string;
  close(): Promise<void>;
}>;
