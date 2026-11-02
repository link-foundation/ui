/**
 * Type declarations of `@link-foundation/ui-store` (see README.md).
 */

import type {
  FormatOptions,
  ParseOptions,
  RawValue,
  UiDocument,
  UiNode,
  UiProperty,
} from '@link-foundation/ui-core';

/** A node to insert: every field but `kind` (or `unknown`) may be left out. */
export interface NodeInput {
  id?: string | null;
  kind?: string | null;
  positional?: RawValue[];
  properties?: UiProperty[];
  children?: NodeInput[];
  unknown?: RawValue[];
}

/** One operation as data (`store.apply`, the operation log). */
export type Op =
  | {
      op: 'insert';
      parentId: string | null;
      index?: number;
      node: NodeInput;
      /** The store IDs of the subtree in pre-order (filled in when applied). */
      ids?: string[];
    }
  | { op: 'remove'; id: string }
  | { op: 'move'; id: string; parentId: string | null; index?: number }
  | {
      op: 'setProp';
      id: string;
      name: string;
      values: RawValue[];
      /** Insert a new property at this position instead of replacing. */
      index?: number;
    }
  | { op: 'removeProp'; id: string; name: string; index?: number }
  | {
      op: 'rename';
      id: string;
      /** `null`: the element becomes anonymous. */
      to: string | null;
      /** The generated ID of an element made anonymous. */
      as?: string;
    };

/** The frozen view of one element (`store.get`). */
export interface ElementView {
  /** The stable store ID. */
  id: string;
  /** The id in the document; `null` for an anonymous element. */
  name: string | null;
  kind: string | null;
  positional: readonly RawValue[];
  properties: readonly UiProperty[];
  unknown: readonly RawValue[];
  parentId: string | null;
}

export type EventType = 'insert' | 'update' | 'remove' | 'move' | 'rename';

export interface StoreEvent {
  /** Increases by one with every event of the store. */
  seq: number;
  /** The transaction the event belongs to. */
  tx: number;
  origin: string;
  type: EventType;
  /** The element (for `rename`, its new ID). */
  id: string;
  parentId: string | null;
  index: number;
  /** The properties after the change; `null` for `remove`. */
  props: readonly UiProperty[] | null;
  /** `update` only: the name of the changed property. */
  prop?: string;
  /**
   * insert: `null`; remove: the element view; update: the old values (or
   * `null`); move: `{ parentId, index }`; rename: the old ID.
   */
  before: unknown;
  /**
   * insert: the element view; remove: `null`; update: the new values (or
   * `null`); move: `{ parentId, index }`; rename: the new ID.
   */
  after: unknown;
}

/** One committed transaction of the operation log. */
export interface LogEntry {
  tx: number;
  origin: string;
  label: string | null;
  /** Set on the transaction of an undo: the transaction it undid. */
  undoes?: number;
  /** Set on the transaction of a redo: the transaction it redid. */
  redoes?: number;
  ops: readonly Op[];
}

export type Listener = (events: readonly StoreEvent[], entry: LogEntry) => void;

export interface StoreOptions {
  document?: Partial<Pick<UiDocument, 'roots' | 'unknown'>>;
  /** Links Notation, read with ui-core `parseOrThrow`. */
  text?: string;
  parseOptions?: ParseOptions;
  /**
   * The store IDs of every element of `document` (or `text`) in pre-order;
   * by default an anonymous element gets a generated ID. A named element's
   * ID must be its name.
   */
  ids?: readonly string[];
  /** How many transactions can be undone (default 500). */
  historyLimit?: number;
  /** Called when a listener throws (default: `console.error`). */
  onListenerError?: (
    error: unknown,
    info: { listener: Listener; events: readonly StoreEvent[]; entry: LogEntry }
  ) => void;
}

export interface Store {
  get(id: string): ElementView | undefined;
  has(id: string): boolean;
  roots(): readonly string[];
  children(id: string): readonly string[];
  parentOf(id: string): string | null;
  indexOf(id: string): number;
  /** Returns the ID of the inserted element. `index` defaults to the end. */
  insert(
    parentId: string | null,
    index: number | undefined,
    node: NodeInput
  ): string;
  remove(id: string): void;
  move(id: string, parentId: string | null, index?: number): void;
  setProp(id: string, name: string, values: RawValue[]): void;
  removeProp(id: string, name: string): void;
  /** Returns the new ID; `to: null` makes the element anonymous. */
  rename(id: string, to: string | null): string;
  /** Apply an operation given as data; returns it as applied. */
  apply(op: Op): Op;
  transaction<T>(
    label: string | null,
    fn: () => T,
    options?: { origin?: string }
  ): T;
  transaction<T>(fn: () => T, options?: { origin?: string }): T;
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  subscribe(listener: Listener): () => boolean;
  log(): readonly LogEntry[];
  /** Apply log entries as new transactions, keeping origin and label. */
  replay(entries: Iterable<LogEntry>): void;
  toDocument(): UiDocument;
  toLino(options?: FormatOptions): string;
}

export function createStore(options?: StoreOptions): Store;

export const DEFAULT_ORIGIN: 'user';
export const DEFAULT_HISTORY_LIMIT: 500;
export const GENERATED_ID_PREFIX: '_';

export function createIdGenerator(
  usedIds?: Iterable<string> | ((id: string) => boolean)
): { next(): string; reserve(id: string): void };

export class StoreError extends Error {
  code:
    | 'unknown-id'
    | 'duplicate-id'
    | 'bad-index'
    | 'cycle'
    | 'unknown-property'
    | 'bad-op'
    | 'bad-node'
    | 'bad-value'
    | 'bad-log'
    | 'in-transaction'
    | 'async-transaction'
    | 'bad-doublets'
    | 'bad-bundle'
    | 'closed';
}

export function logToLino(entries: readonly LogEntry[]): string;
export function logFromLino(text: string): LogEntry[];

/** One doublets link: a point when `index === source === target`. */
export interface Doublet {
  index: number;
  source: number;
  target: number;
}

/** A document as doublets (see README.md, "The doublets encoding"). */
export interface EncodedDocument {
  /** Ordered by index, starting at 1. */
  links: Doublet[];
  /** Reference string → the index of its point. */
  names: Map<string, number>;
  /** [the root elements, the top-level links that are not elements] */
  roots: number[];
}

/** The strings of the two points of the empty list: `['list', 'end']`. */
export const NIL_POINTS: readonly ['list', 'end'];
export function encodeDocument(
  document: Partial<Pick<UiDocument, 'roots' | 'unknown'>>
): EncodedDocument;
/** Throws a `StoreError` (`bad-doublets`) for doublets of another form. */
export function decodeDocument(encoded: {
  links: Iterable<Doublet>;
  names: Map<string, number> | Iterable<[string, number]>;
  roots: number[];
}): UiDocument;

/** The part of a doublets-web `UnitedLinks` that the adapter uses. */
export interface UnitedLinksLike {
  create(): number;
  update(index: number, source: number, target: number): number;
}
/**
 * Create every link of `encoded` in `unitedLinks` in index order; returns
 * the index of each link → its index in `unitedLinks`.
 */
export function copyToDoubletsWeb(
  encoded: { links: Iterable<Doublet> },
  unitedLinks: UnitedLinksLike
): Map<number, number>;
/** Load the optional peer `doublets-web` and create an empty `UnitedLinks`. */
export function openDoubletsWeb(
  load?: () => Promise<unknown>
): Promise<{ module: any; links: any }>;

export interface BundleLimits {
  /** Default: ui-core `DEFAULT_MAX_DEPTH`. */
  maxDepth?: number;
  /** In characters. Default: ui-core `DEFAULT_MAX_INPUT_SIZE`. */
  maxInputSize?: number;
}
export const DEFAULT_BUNDLE_LIMITS: Readonly<Required<BundleLimits>>;
/** The head of the first link of a bundle: `'ui_store_bundle'`. */
export const BUNDLE_HEAD: 'ui_store_bundle';
/** The IndexedDB version of the database and the bundle `schema`. */
export const SCHEMA_VERSION: 1;
export const DATABASE_PREFIX: 'link-ui-';
/** `link-ui-<name>` */
export function databaseName(name: string): string;

/**
 * The part of an `IDBFactory` that is used (`globalThis.indexedDB` in a
 * browser, `new IDBFactory()` of fake-indexeddb in Node.js).
 */
export interface IndexedDBFactory {
  open(name: string, version?: number): unknown;
  deleteDatabase(name: string): unknown;
}

/** The part of a `BroadcastChannel` that is used. */
export interface BroadcastChannelLike {
  postMessage(message: { tx: number }): void;
  close(): void;
  onmessage: ((event: { data: { tx: number } }) => void) | null;
}

export interface PersistentStoreOptions {
  /** The database is `link-ui-<name>`. */
  name: string;
  /** Default: `globalThis.indexedDB`. */
  indexedDB?: IndexedDBFactory;
  /** LiNo of the document when the database has no data yet. */
  initialText?: string;
  /** Tell other tabs to reload through a BroadcastChannel (default `true`). */
  channel?: boolean;
  /** Default: `globalThis.BroadcastChannel`. */
  BroadcastChannel?: new (name: string) => BroadcastChannelLike;
  /** More options of `createStore` (`historyLimit`, `onListenerError`, ...). */
  storeOptions?: Omit<StoreOptions, 'document' | 'text' | 'ids'>;
  /** The default limits of `importBundle`. */
  bundleLimits?: BundleLimits;
  /** A write failed (default: `console.error`); `flush()` rejects too. */
  onError?: (error: unknown) => void;
}

export interface Persistence {
  readonly name: string;
  /** `link-ui-<name>` */
  readonly databaseName: string;
  /** Resolves when every queued write is done; rejects if one failed. */
  flush(): Promise<void>;
  /** Rewrite the snapshot from the current document and empty the log. */
  compact(): Promise<void>;
  /** The `.lino` bundle of the database: snapshot and log. */
  exportBundle(): Promise<string>;
  /**
   * Replace everything with a bundle in one IndexedDB transaction. Throws
   * (and changes nothing) for a bundle over the limits (ui-core
   * `UiParseError`), a bad bundle (`bad-bundle`, `bad-log`) or a log that
   * cannot be replayed. Ask the user before calling it.
   */
  importBundle(text: string, limits?: BundleLimits): Promise<void>;
  /** Read the database again (another tab wrote to it). */
  reload(): Promise<void>;
  /** Called after `reload()` or `importBundle()` replaced the document. */
  onReload(listener: () => void): () => boolean;
  /** The doublets of the snapshot as stored. */
  readDoublets(): Promise<EncodedDocument>;
  /** Wait for the writes and close; later edits stay in memory only. */
  close(): Promise<void>;
  /** Close and delete the database. Ask the user before calling it. */
  destroy(): Promise<void>;
}

/**
 * A store saved to IndexedDB. `store` stays valid when `reload()` or
 * `importBundle()` replaces the document; its listeners are kept.
 */
export function openPersistentStore(
  options: PersistentStoreOptions
): Promise<{ store: Store; persistence: Persistence }>;

export type { RawValue, UiDocument, UiNode, UiProperty };
