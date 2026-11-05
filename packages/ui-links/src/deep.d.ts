import type { Policy, SyncedTriplets } from './index.js';

/** Hasura boolean expressions, with scalar id shorthand. */
export type DeepWhere = number | Record<string, unknown>;
export interface DeepQueryOptions {
  remote?: boolean;
  apply?: string;
  table?: 'links' | 'strings' | 'numbers' | 'objects' | 'can';
  returning?: string;
  limit?: number;
  offset?: number;
  order_by?: Record<string, string> | Record<string, string>[];
  aggregate?: 'count';
}
export interface DeepValue {
  id: number;
  link_id: number;
  value: unknown;
}
export interface DeepLink {
  id: number;
  type_id?: number;
  from_id?: number;
  to_id?: number;
  value?: DeepValue;
  string?: DeepValue;
  number?: DeepValue;
  object?: DeepValue;
  readonly from?: DeepLink;
  readonly to?: DeepLink;
  readonly type?: DeepLink;
  readonly in: DeepLink[];
  readonly out: DeepLink[];
  readonly typed: DeepLink[];
  readonly inByType: Record<number, DeepLink[]>;
  readonly outByType: Record<number, DeepLink[]>;
  readonly _applies: string[];
  toPlain(): Record<string, unknown>;
}
export interface DeepSubscription {
  readonly closed: boolean;
  unsubscribe(): void;
}
export interface DeepObservable<T> {
  subscribe(
    observer:
      | ((value: T) => void)
      | { next?(value: T): void; error?(error: Error): void }
  ): DeepSubscription;
}
export interface DeepEmitter {
  on(event: string, listener: (...args: any[]) => void): DeepEmitter;
  off(event: string, listener: (...args: any[]) => void): DeepEmitter;
  removeListener(
    event: string,
    listener: (...args: any[]) => void
  ): DeepEmitter;
  emit(event: string, ...args: any[]): void;
}
export interface DeepApplyResult {
  data: DeepLink[];
  plainLinks: Record<string, unknown>[];
  errors: Error[];
  anomalies: Error[];
}
export type DeepRow = DeepLink | Record<string, unknown>;
export interface Minilinks {
  readonly links: DeepLink[];
  readonly byId: Record<number, DeepLink>;
  readonly byFrom: Record<number, DeepLink[]>;
  readonly byTo: Record<number, DeepLink[]>;
  readonly byType: Record<number, DeepLink[]>;
  readonly types: Record<number, DeepLink[]>;
  readonly virtual: Record<number, number>;
  readonly virtualInverted: Record<number, number>;
  readonly emitter: DeepEmitter;
  deep?: DeepClient;
  add(rows: DeepRow[], name?: string): DeepApplyResult;
  update(rows: DeepRow[], name?: string): DeepApplyResult;
  remove(ids: number[], name?: string): DeepApplyResult;
  apply(
    rows: DeepRow[] | { data?: DeepRow[]; options?: DeepQueryOptions },
    name?: string,
    options?: Record<string, unknown>
  ): DeepApplyResult;
  remap(temporary: number, real: number): void;
  query(
    where?: DeepWhere,
    options?: DeepQueryOptions & { aggregate?: undefined }
  ): DeepLink[];
  query(
    where: DeepWhere,
    options: DeepQueryOptions & { aggregate: 'count' }
  ): number;
  select: Minilinks['query'];
  subscribe(
    where?: DeepWhere,
    options?: DeepQueryOptions
  ): DeepObservable<DeepLink[] | number>;
  id(start: number | string, ...path: (string | boolean)[]): number;
  name(id: number | { id: number }): string | undefined;
}
export interface DeepResult<T = DeepLink[]> {
  data: T;
  loading: false;
}
export interface DeepClient {
  readonly ml: Minilinks;
  readonly minilinks: Minilinks;
  readonly synced: SyncedTriplets;
  readonly emitter: DeepEmitter;
  linkId: number | null;
  token?: string;
  select(
    where?: DeepWhere,
    options?: DeepQueryOptions & { aggregate?: undefined }
  ): Promise<DeepResult>;
  select(
    where: DeepWhere,
    options: DeepQueryOptions & { aggregate: 'count' }
  ): Promise<DeepResult<number>>;
  insert(
    input: Record<string, unknown> | Record<string, unknown>[],
    options?: DeepQueryOptions
  ): Promise<DeepResult>;
  update(
    where: DeepWhere,
    changes: Record<string, unknown>,
    options?: DeepQueryOptions
  ): Promise<DeepResult>;
  delete(where: DeepWhere, options?: DeepQueryOptions): Promise<DeepResult>;
  subscribe(
    where?: DeepWhere,
    options?: DeepQueryOptions
  ): DeepObservable<DeepResult<DeepLink[] | number>>;
  id(
    start: number | string | DeepWhere,
    ...path: (string | boolean)[]
  ): Promise<number>;
  idLocal(start: number | string, ...path: (string | boolean)[]): number;
  can(
    object: number,
    subject?: number | null,
    action?: number | string
  ): Promise<boolean>;
  resolve(id: number): number;
  flush(): Promise<void>;
  guest(): Promise<{ linkId: number; token: string }>;
  /** Disposes this adapter; the caller still owns the synced transport. */
  close(): void;
}
export function createMinilinks(): Minilinks;
export function createDeepClient(
  synced: SyncedTriplets,
  options?: {
    minilinks?: Minilinks;
    policy?: Policy;
    subject?: number | null;
    actions?: Record<string | number, string | number>;
  }
): DeepClient;
export function createSyncedDeepLinks(options: {
  url: string;
  token?: string;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
  WebSocket?: typeof WebSocket;
  protocol?: 'graphql-ws' | 'graphql-transport-ws';
  /** Requests contain user data; tracing is disabled unless supplied. */
  trace?: (operation: {
    query: string;
    variables: Record<string, unknown>;
  }) => void;
}): SyncedTriplets & { close(): void };
