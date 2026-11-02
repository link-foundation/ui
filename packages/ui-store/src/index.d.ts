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
    | 'async-transaction';
}

export function logToLino(entries: readonly LogEntry[]): string;
export function logFromLino(text: string): LogEntry[];

export type { RawValue, UiDocument, UiNode, UiProperty };
