/** All records are flat. References are IDs; adapters own transport semantics. */
export type ChatKind =
  | 'chat'
  | 'message'
  | 'participant'
  | 'attachment'
  | 'reaction'
  | 'step';
export interface ChatRecord {
  id: string;
  kind: ChatKind;
  [field: string]: string | number | boolean | undefined;
}
export interface Message extends ChatRecord {
  kind: 'message';
  chat?: string;
  sender?: string;
  time?: string;
  text?: string;
  outgoing?: boolean;
  unread?: boolean;
  status?: string;
}
export interface Chat extends ChatRecord {
  kind: 'chat';
  title?: string;
  unread?: number;
  'can-edit'?: boolean;
  'can-react'?: boolean;
  'can-reply'?: boolean;
  'max-attachments'?: number;
}
export function parseChatData(links: string | unknown[]): ChatRecord[];
export function chatDataToLino(data: ChatRecord[]): string;
export interface StreamState {
  messages: Message[];
  hasOlder: boolean;
  hasNewer: boolean;
  highlighted: string | null;
  loading: boolean;
  error: Error | null;
}
export interface StreamSource {
  load(query: {
    before?: string;
    after?: string;
    around?: string;
    limit: number;
    signal: AbortSignal;
  }): Promise<{ messages: Message[]; hasOlder: boolean; hasNewer: boolean }>;
}
export interface StreamWindow {
  loadOlder(): Promise<void>;
  loadNewer(): Promise<void>;
  jumpTo(id: string): Promise<void>;
  state(): StreamState;
  subscribe(fn: (state: StreamState) => void): () => void;
  disconnect(): void;
  readonly prefetch: number;
}
export function createStreamWindow(
  source: StreamSource,
  options?: { pageSize?: number; prefetch?: number; ceiling?: number }
): StreamWindow;
export interface ChatDateOptions {
  clock: () => number;
  locale?: string;
  timeZone?: string;
  labels?: Record<string, string>;
}
export const CHAT_FILTERS: readonly string[];
export const DAY_GROUPS: readonly string[];
export const CHAT_KINDS: readonly string[];
export function chatVocabulary(): ReturnType<
  typeof import('@link-foundation/ui-core').defaultVocabulary
>;
export function dayGroup(iso: string, options: ChatDateOptions): string;
export function dayLabel(iso: string, options: ChatDateOptions): string;
export function deliveryStatus(message: Message): string | null;
export function unreadCount(messages: Message[], chat?: Partial<Chat>): number;
export function messageRuns(
  messages: Message[],
  options?: { gap?: number; timeZone?: string }
): { sender: string; messages: Message[] }[];
export function summarizeChats(
  data: ChatRecord[],
  options?: { filter?: string }
): (Chat & { last: Message | null })[];
export function sortChats<T extends { pinned?: number; last?: Message | null }>(
  chats: T[],
  order?: 'latest' | 'oldest'
): T[];
export interface ChatSelection {
  state(): {
    selected: Set<string>;
    target: string | null;
    anchor: string | null;
  };
  target(id: string | null): void;
  select(
    id: string,
    options?: { toggle?: boolean; range?: boolean; keys?: string[] }
  ): void;
  clear(): void;
}
export function createChatSelection(): ChatSelection;
export function firstUnread(messages: Message[]): string | null;
export function createFollow(
  root: HTMLElement,
  options?: { threshold?: number }
): {
  state(): { following: boolean };
  pause(): void;
  toBottom(): void;
  refresh(): void;
  disconnect(): void;
};
/** Pass as `chat` in ui-dom mount options. Sources remain owned by the host. */
export interface ChatOptions extends ChatDateOptions {
  data:
    | ChatRecord[]
    | { get(): ChatRecord[]; subscribe?(fn: () => void): () => void };
  windows?: Record<string, StreamWindow>;
  spaceTarget?: HTMLElement;
  slots?: {
    message?: (
      message: Message,
      context: { document: Document }
    ) => Node | string;
    before?: (context: { document: Document; composer: HTMLElement }) => Node;
    attachments?: (context: {
      document: Document;
      composer: HTMLElement;
    }) => Node;
    after?: (context: { document: Document; composer: HTMLElement }) => Node;
  };
}

export function calendarDay(
  iso: string | number,
  timeZone?: string
): number | null;
