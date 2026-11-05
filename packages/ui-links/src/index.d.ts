/**
 * Type declarations of `@link-foundation/ui-links` (see README.md).
 */
export * from './deep.js';

// Constants (doublets-web's numbers)

/** The empty reference: no link. */
export const NULL: 0;
/** Matches any value in a query. */
export const ANY: 4294967292;
/** Returned by an `each` handler to go on. */
export const CONTINUE: 4294967295;
/** Returned by an `each` handler to stop. */
export const BREAK: 4294967294;
export const SKIP: 4294967293;
export const ITSELF: 4294967291;
export const ERROR: 4294967290;
/** The largest address a link can have. */
export const MAX_ADDRESS: 4294967289;
/** Shaped like doublets-web's `LinksConstants`. */
export const constants: Readonly<{
  _null: number;
  any: number;
  _continue: number;
  _break: number;
  skip: number;
  itself: number;
  error: number;
  index_part: number;
  source_part: number;
  target_part: number;
}>;

// The storage interface

/** A link: `(id: from_id to_id)`. */
export interface Link {
  readonly id: number;
  readonly from_id: number;
  readonly to_id: number;
}

/** A query: an object (a missing part is `ANY`), `[id, source, target]` or nothing. */
export type LinksQuery =
  | { id?: number | null; from_id?: number | null; to_id?: number | null }
  | (number | null | undefined)[]
  | null
  | undefined;

/** The interface of every storage, the one of doublets-web's `UnitedLinks`. */
export interface LinksStorage {
  constants?: typeof constants;
  /** The address of a new link `(0 0)`. */
  create(): number;
  update(id: number, source: number, target: number): number;
  /** No cascade: see `withCascade`. */
  delete(id: number): number;
  count(query?: LinksQuery): number;
  /** `CONTINUE`, or `BREAK` when the handler returned `BREAK`. */
  each(handler: (link: Link) => number, query?: LinksQuery): number;
  /** Create the link at that free address (optional). */
  createAt?(id: number): number;
}

/** A write and its result: `before` is `null` for a create, `after` for a delete. */
export interface Change {
  readonly before: Link | null;
  readonly after: Link | null;
}

export type LinksErrorCode =
  | 'not-found'
  | 'forbidden'
  | 'bad-request'
  | 'limit'
  | 'bad-reference'
  | 'exists'
  | 'bad-reply'
  | 'remote'
  | 'offline'
  | 'closed'
  | (string & {});

export class LinksError extends Error {
  constructor(code: LinksErrorCode, message: string);
  code: LinksErrorCode;
}

export function notFound(id: number): LinksError;
export function normalizeQuery(query?: LinksQuery): {
  id: number;
  from_id: number;
  to_id: number;
};
export function matches(
  link: Link,
  query: { id: number; from_id: number; to_id: number }
): boolean;
export function linkOf(id: number, source: number, target: number): Link;
export function isAddress(id: unknown): id is number;
export function checkParts(source: number, target: number): void;
/** Every link that matches `query`, by address. */
export function allLinks(links: LinksStorage, query?: LinksQuery): Link[];
export function getLink(links: LinksStorage, id: number): Link | null;
export function exists(links: LinksStorage, id: number): boolean;
/** The first link `(source target)` by address. */
export function search(
  links: LinksStorage,
  source: number,
  target: number
): Link | null;
/** Make sure the link at `id` exists; whether it created it. */
export function ensureCreated(links: LinksStorage, id: number): boolean;
/** A decorator: every method `methods` does not replace is forwarded. */
export function decorate<T extends LinksStorage>(
  inner: T,
  methods: Partial<LinksStorage> & Record<string, unknown>
): T & { inner: T };

// Storages

export function createMemoryLinks(): LinksStorage & {
  createAt(id: number): number;
};

/** The database shape of `node:sqlite`'s `DatabaseSync` and better-sqlite3. */
export interface SqlDatabase {
  exec(sql: string): unknown;
  prepare(sql: string): {
    run(...params: unknown[]): unknown;
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  };
}
export function createSqlLinks(
  db: SqlDatabase,
  options?: { table?: string }
): LinksStorage & { createAt(id: number): number };

export function fromDoubletsWeb(
  module: { Link: new (id: number, source: number, target: number) => any },
  united: any
): LinksStorage & { united: any };
export function openDoubletsWebLinks(
  load?: () => Promise<any>
): Promise<LinksStorage & { united: any }>;

// Decorators

export function observe<T extends LinksStorage>(
  links: T,
  listener: (change: Change) => void
): T;
/** `id` and every link that uses it, transitively. */
export function dependentsOf(links: LinksStorage, id: number): Link[];
/** Delete `id` and every link that uses it; the deleted links. */
export function deleteCascade(links: LinksStorage, id: number): Link[];
export function withCascade<T extends LinksStorage>(links: T): T;
export function netChanges(changes: Change[]): Change[];
export function sameLink(a: Link | null, b: Link | null): boolean;
export function snapshot(links: LinksStorage): Link[];

// Names

export interface NamesStore {
  setName(id: number, name: string): number;
  getName(id: number): string | null;
  getByName(name: string): number | null;
  removeName(id: number): boolean;
  entries(): [number, string][];
}
export function isName(name: unknown): name is string;
export function createNames(entries?: Iterable<[number, string]>): NamesStore;
export interface LinksNames extends NamesStore {
  withLinks(links: LinksStorage): LinksNames;
  dependencies(ids: Iterable<number>): Link[];
  bindings(ids: Iterable<number>): Link[];
}
/** Names encoded as doublets in the same storage, without a sidecar. */
export function createLinksNames(links: LinksStorage): LinksNames;

// Links Notation

/** A reference is a string, a link is `{ id, values }`. */
export type LinoValue = string | { id: string | null; values: LinoValue[] };
export function group(values: LinoValue[]): LinoValue;
export function named(id: string, values: LinoValue[]): LinoValue;
export function parseLino(text: string): LinoValue[];
export function formatLino(document: LinoValue[]): string;
export function isBinary(bytes: Uint8Array): boolean;
export function decodeBinary(
  bytes: Uint8Array
): { document: LinoValue[]; options: any; size: number } | null;
export function encodeBinary(document: LinoValue[], options?: any): Uint8Array;
export function linksToLino(
  links: LinksStorage,
  options?: { names?: NamesStore }
): string;
export function linksFromLino(
  links: LinksStorage,
  text: string,
  options?: { names?: NamesStore }
): number[];
export function namesToLino(names: NamesStore): string;
export function namesFromLino(names: NamesStore, text: string): NamesStore;

// Queries

export interface QueryContext {
  links: LinksStorage;
  /**
   * The storage under `links` when it is a restricted view: references are
   * checked and failed writes undone there.
   */
  base?: LinksStorage;
  names?: NamesStore;
  /** Create missing references as points `(x: x x)`. */
  autoCreate?: boolean;
}
export function patternOf(value: LinoValue): any;
export function querySides(document: LinoValue[]): [any, any] | null;
/** Run `fn` as one atomic write; the net changes. */
export function transact(
  context: QueryContext,
  fn: (
    links: LinksStorage,
    recorded: Change[],
    named: number[],
    names?: NamesStore
  ) => void
): Change[];
/** Run a substitution query (LiNo text or a parsed document). */
export function runQuery(
  context: QueryContext,
  query: string | LinoValue[]
): Change[];
export function rollback(links: LinksStorage, recorded: Change[]): void;

// Types

export interface TypeSystem {
  root: number;
  /** Storage that holds the type hierarchy. */
  links: LinksStorage;
  /** Whether committed writes can change the ancestry of other links. */
  affects(changes: Change[], storage: LinksStorage): boolean;
  typeOf(value: number | Link): number | null;
  isType(id: number): boolean;
  parentsOf(type: number): number[];
  /** Itself first, breadth first. */
  ancestorsOf(type: number): number[];
  /** Whether `id` is a pair that gives a type one more parent. */
  isExtension(id: number): boolean;
  /** Of `type` through sub-types and parents; not reflexive. */
  isOf(value: number | Link, type: number): boolean;
  /** `type` itself or of `type`. */
  isA(value: number | Link, type: number): boolean;
  /** A type `(S: parent S)`, more parents through `Extends`. */
  define(parent?: number, ...more: number[]): number;
  /** A value `(v: type target)`. */
  instance(type: number, target?: number | null): number;
}
export function typeSystem(
  links: LinksStorage,
  markers: { root: number; extends?: number | null }
): TypeSystem;
export function typeMarkers(
  links: LinksStorage,
  names: NamesStore
): { root: number; extends: number };
/** The point of `name`, created when missing. */
export function point(
  links: LinksStorage,
  names: NamesStore,
  name: string
): number;

// Permissions

export interface PermissionMarkers {
  allowRead: number;
  allowWrite: number;
  allowReference: number;
  anything: number;
}
export interface Policy {
  markers: PermissionMarkers;
  /** Optional server-local cache; permission views continue to read live rules. */
  watch?(): {
    canRead(subject: number | null, link: Link): boolean;
    refresh(
      changes: Change[],
      storage: LinksStorage
    ): (subject: number | null) => boolean;
    forget(subject: number | null): boolean;
  };
  canRead(subject: number | null, link: Link): boolean;
  canWrite(subject: number | null, link: Link): boolean;
  /**
   * Whether the subject may refer to the link without reading it. Without it
   * a view answers an unreadable address as a missing one.
   */
  canReference?(subject: number | null, link: Link): boolean;
  canCreate(subject: number | null): boolean;
}
export function forbidden(what: string): LinksError;
export function createPolicy(options: {
  rules: LinksStorage;
  markers: PermissionMarkers;
  types: TypeSystem;
}): Policy;
/**
 * The storage as `subject` sees it. A link created through the view is the
 * subject's own while its source is 0; `forget(id)` drops that claim when
 * the link is gone. A reference the subject may not make (`canReference`)
 * throws `not-found`, the same as a missing address.
 */
export function withPermissions<T extends LinksStorage>(
  links: T,
  policy: Policy,
  subject: number | null | (() => number | null)
): T & { forget(id: number): void; canReference(id: number): boolean };
export function permissionMarkers(
  links: LinksStorage,
  names: NamesStore
): PermissionMarkers;
/** Write a rule; the address of the rule pair. */
export function allow(
  rules: LinksStorage,
  markers: PermissionMarkers,
  access: 'read' | 'write' | 'reference',
  subject: number,
  object: number
): number;

// Persistence

export interface PersistenceAdapter {
  load():
    | Iterable<[number, number, number]>
    | Promise<Iterable<[number, number, number]>>;
  put(id: number, source: number, target: number): unknown;
  remove(id: number): unknown;
  flush?(): Promise<void>;
  close?(): unknown;
}
/** A cache adapter with a LiNo sync checkpoint sidecar. */
export interface SyncPersistenceAdapter extends PersistenceAdapter {
  loadState(): string | null | undefined | Promise<string | null | undefined>;
  saveState(text: string): unknown;
}
export function persistLinks<T extends LinksStorage>(
  links: T,
  adapter: PersistenceAdapter
): Promise<T & { flush(): Promise<void> }>;
export function triplesFromLino(text: string): [number, number, number][];
export function triplesOf(links: LinksStorage): [number, number, number][];
export function localStorageAdapter(
  storage: {
    readonly length: number;
    key(index: number): string | null;
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
  },
  prefix?: string
): SyncPersistenceAdapter;
/** The part of `IDBFactory` the adapter uses. */
export interface IndexedDbFactory {
  open(name: string, version?: number): any;
}
export function indexedDbAdapter(
  indexedDB: IndexedDbFactory,
  name: string
): SyncPersistenceAdapter & { flush(): Promise<void>; close(): void };
export function linoTextAdapter(io: {
  read: () => string | Promise<string>;
  write: (text: string) => void;
}): SyncPersistenceAdapter;

// Framing (`clink --serve`)

export const MAX_MESSAGE_BYTES: number;
export function encodeMessage(text: string): Uint8Array;
export function createMessageReader(handlers: {
  onText: (text: string) => void;
  onBinary?: (bytes: Uint8Array) => void;
  maxBytes?: number;
}): { push(chunk: Uint8Array): void };

// Server

export interface LinksSession {
  readonly subject: number | null;
  handle(document: LinoValue[]): LinoValue[];
  /** The text protocol. */
  request(text: string): string;
  /** The binary protocol: a packet of the same options. */
  requestBinary(bytes: Uint8Array): Uint8Array;
  deliver(changes: Change[]): void;
  close(): void;
}
export interface LinksServer {
  links: LinksStorage;
  names: NamesStore;
  policy: Policy | null;
  /** The triplets of `links`, when the server is in triplet mode. */
  triplets?: TripletsView;
  session(options?: {
    subject?: number | null;
    onPush?: (document: LinoValue[]) => void;
  }): LinksSession;
  readonly sessions: LinksSession[];
}
export function createLinksServer(options: {
  links: LinksStorage;
  names?: NamesStore;
  policy?: Policy | null;
  authenticate?: ((token: string) => number | null) | null;
  autoCreate?: boolean;
  /** Speak triplets: link-cli's `docs/protocol/triplets.txt`. */
  triplets?: boolean;
}): LinksServer;
export function changeToLino(
  change: Change,
  ref?: (id: number) => string
): LinoValue;

// Synced client

export interface Transport {
  send(text: string): Promise<string>;
  onPush?(listener: (text: string) => void): () => void;
  close?(): unknown;
}
export interface SyncedChange extends Change {
  readonly origin: 'local' | 'remote' | 'rollback' | 'remap';
}
export interface PendingWrite {
  kind: 'create' | 'update' | 'delete';
  id: number;
  source: number;
  target: number;
  changes: Change[];
}
export interface SyncedLinks extends LinksStorage {
  readonly cache: LinksStorage;
  readonly names: LinksNames;
  connect(transport: Transport): Promise<void>;
  disconnect(): void;
  readonly connected: boolean;
  /** Writes the server has not answered yet. */
  readonly pending: number;
  flush(): Promise<void>;
  /** The real address of a temporary one. */
  resolve(id: number): number;
  isTemporary(id: number): boolean;
  load(restriction?: (number | null)[]): Promise<Link[]>;
  subscribe(
    restriction?: (number | null)[]
  ): Promise<{ id: number; links: Link[] }>;
  unsubscribe(id: number): Promise<void>;
  /** A substitution query on the server; its changes enter the cache. */
  query(text: string): Promise<Change[]>;
  onChange(listener: (change: SyncedChange) => void): () => boolean;
  onError(
    listener: (error: Error, write: PendingWrite | null) => void
  ): () => boolean;
  onRemap(listener: (temp: number, id: number) => void): () => boolean;
}
export function createSyncedLinks(options?: {
  transport?: Transport | null;
  cache?: LinksStorage;
}): SyncedLinks;
/** Restore durable offline writes before connecting; await flush before reload. */
export function openSyncedLinks(options: {
  adapter: SyncPersistenceAdapter;
  transport?: Transport | null;
  cache?: LinksStorage;
}): Promise<SyncedLinks>;
export function connectInProcess(
  server: LinksServer,
  options?: { subject?: number | null }
): Transport & { session: LinksSession };
export function changesFromLino(
  document: LinoValue[],
  ref?: (text: string) => number
): Change[];

// Triplets

/** `(index: type from to)`: a type, and two parts that may be 0. */
export interface Triplet {
  index: number;
  type: number;
  from: number;
  to: number;
}
export type TripletQuery =
  | Partial<Record<keyof Triplet, number | null>>
  | (number | null | undefined)[];
export interface TripletMarkers {
  pair: number;
  nothing: number;
}
export interface TripletsReads {
  getTriplet(index: number): Triplet | null;
  isTriplet(index: number): boolean;
  eachTriplet(query?: TripletQuery): Triplet[];
  countTriplets(query?: TripletQuery): number;
}
export interface TripletsWrites {
  /** `(i: type from to)`; `type` must be a triplet. */
  createTriplet(type: number, from?: number, to?: number): number;
  createTripletPoint(): number;
  /** The triplet as it was before. */
  updateTriplet(index: number, type: number, from: number, to: number): Triplet;
  /** Every triplet removed, `index` first. */
  deleteTriplet(index: number): Triplet[];
}
/** A storage of doublets that also reads and writes the triplets in them. */
export interface TripletsView
  extends LinksStorage, TripletsReads, TripletsWrites {
  readonly markers: TripletMarkers;
  readonly names: NamesStore | undefined;
  readonly doublets: LinksStorage;
  /** The same view over a layer of the same storage. */
  over(other: LinksStorage): TripletsView;
  createTripletPointAt(address: number): void;
  /** How many doublets use the doublet at `id`, itself left out. */
  doubletUsages(id: number): number;
  /** What the doublet at `address` is in the encoding. */
  roleOf(address: number): { kind: string; triplet?: Triplet } | null;
}
export function tripletMarkers(
  links: LinksStorage,
  names: NamesStore
): TripletMarkers;
export function matchesTriplet(triplet: Triplet, query?: TripletQuery): boolean;
/** What deleting `first` deletes, `first` first: it and what uses it. */
export function cascadeOf(
  triplets: Pick<TripletsReads, 'eachTriplet'>,
  first: Triplet
): Triplet[];
export function withTriplets(
  links: LinksStorage,
  options?: { names?: NamesStore; markers?: TripletMarkers }
): TripletsView;
export function withTripletPermissions(
  triplets: TripletsView,
  policy: Policy,
  subject: number | null,
  created?: Set<number>
): TripletsView;
export function processTripletsQuery(
  triplets: TripletsView,
  names: NamesStore | undefined,
  document: LinoValue[],
  named?: unknown[]
): TripletChange[];
export function transactTriplets<T>(
  context: { links: TripletsView; names?: NamesStore },
  fn: (
    triplets: TripletsView,
    names: NamesStore | undefined,
    named: unknown[]
  ) => T
): T;
export function packTriplets(
  document: LinoValue[],
  options?: unknown
): LinoValue[];
export function canonicalTriplets(document: LinoValue[]): LinoValue[];
export function createTripletsSession(session: {
  context: { links: TripletsView; names?: NamesStore };
  state: {
    subscriptions: Map<number, unknown>;
    next: number;
    format?: unknown;
  };
  nameRef: (id: number) => string;
  publish: (changes: TripletChange[]) => void;
  onPush?: (document: LinoValue[]) => void;
}): {
  operations: Record<string, ((argument: LinoValue) => LinoValue[]) | null>;
  list(): LinoValue[];
  query(document: LinoValue[]): LinoValue[];
  deliver(changes: TripletChange[], own: boolean): void;
};

// Synced triplets client

export interface TripletChange {
  readonly before: Triplet | null;
  readonly after: Triplet | null;
}
export interface SyncedTripletChange extends TripletChange {
  readonly origin: 'local' | 'remote' | 'rollback' | 'remap';
}
export interface PendingTripletWrite {
  kind: 'create' | 'update' | 'delete';
  index: number;
  type?: number;
  from?: number;
  to?: number;
  point?: boolean;
  changes: TripletChange[];
}
export interface SyncedTriplets extends TripletsReads, TripletsWrites {
  /** Without parts it is a point, like `createTripletPoint`. */
  createTriplet(type?: number, from?: number, to?: number): number;
  create(type?: number, from?: number, to?: number): number;
  update(index: number, type: number, from: number, to: number): number;
  delete(index: number): number;
  count(query?: TripletQuery): number;
  each(
    handler: (triplet: Triplet) => unknown,
    query?: TripletQuery
  ): typeof CONTINUE | typeof BREAK;
  connect(transport: Transport): Promise<void>;
  disconnect(): void;
  readonly connected: boolean;
  /** Writes the server has not answered yet. */
  readonly pending: number;
  flush(): Promise<void>;
  /** The real address of a temporary one. */
  resolve(index: number): number;
  isTemporary(index: number): boolean;
  load(restriction?: (number | null)[]): Promise<Triplet[]>;
  remoteCount(restriction?: (number | null)[]): Promise<number>;
  subscribe(
    restriction?: (number | null)[]
  ): Promise<{ id: number; triplets: Triplet[] }>;
  unsubscribe(id: number): Promise<void>;
  /** A substitution query on the server; its changes enter the cache. */
  query(text: string): Promise<TripletChange[]>;
  onChange(listener: (change: SyncedTripletChange) => void): () => boolean;
  onError(
    listener: (error: Error, write: PendingTripletWrite | null) => void
  ): () => boolean;
  onRemap(listener: (temp: number, index: number) => void): () => boolean;
}
export function createSyncedTriplets(options?: {
  transport?: Transport | null;
}): SyncedTriplets;
