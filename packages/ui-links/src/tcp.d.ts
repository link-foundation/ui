/**
 * Type declarations of `@link-foundation/ui-links/tcp` (Node.js only).
 */

import type { LinksServer, Transport } from '@link-foundation/ui-links';

/** Serve `server` on TCP, framed like `clink --serve`. */
export function listenLinks(
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
  close(): Promise<void>;
}>;

/** Whether a message is a push: its first link is `(notify: n)`. */
export function isPush(text: string): boolean;

/** A text transport that tells pushes from replies; `address` is `host:port`. */
export function connectLinks(
  address: string
): Promise<Transport & { close(): Promise<void> }>;
