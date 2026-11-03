export interface DataItem {
  id: string;
  label?: string;
  children?: DataItem[];
  hasChildren?: boolean;
  [key: string]: unknown;
}
export interface DataSource<T = DataItem> {
  get(): T[];
  set(items: T[]): void;
  subscribe(listener: (items: T[]) => void): () => void;
}
export function createDataSource<T = DataItem>(items?: T[]): DataSource<T>;
export function listOffsets(input: {
  count: number;
  estimate: number;
  measured?: Map<number, number>;
}): Float64Array;
export function indexAt(offsets: Float64Array, y: number): number;
export function listRange(
  offsets: Float64Array,
  scrollTop: number,
  viewportHeight: number,
  overscan?: number
): { start: number; end: number };
export interface AnchorSnapshot {
  keys: string[];
  offsets: Float64Array;
  scrollTop: number;
}
export function anchorScrollTop(
  before: AnchorSnapshot,
  after: Omit<AnchorSnapshot, 'scrollTop'>,
  anchorKey: string
): number;
export function selectItem(input: {
  keys: string[];
  selected?: Set<string>;
  anchor?: string | null;
  key: string;
  mode?: 'single' | 'multi' | 'none';
  shift?: boolean;
  toggle?: boolean;
}): { selected: Set<string>; anchor: string | null };
export interface DataSort {
  column: string;
  direction: 'ascending' | 'descending' | 'none';
}
export function nextSort(current: DataSort | null, column: string): DataSort;
export function sortItems<T>(
  items: T[],
  sort?: DataSort,
  compare?: (a: T, b: T) => number
): T[];
export function dataVocabulary(): import('@link-foundation/ui-core').Vocabulary;
export const DATA_VOCABULARY_TEXT: string;
export function flattenTree(
  items: DataItem[],
  expanded: Set<string>,
  loaded?: Map<string, DataItem[]>
): DataItem[];

/** Host adapters shared by the three registered kinds. */
export interface DataOptions {
  sources?: Record<string, DataItem[] | Pick<DataSource, 'get' | 'subscribe'>>;
  templates?: Record<
    string,
    (item: DataItem, context: { document: Document }) => string | Node
  >;
  loadChildren?(
    item: DataItem,
    context: { signal: AbortSignal }
  ): Promise<DataItem[]>;
  clock?: import('../behavior/index.js').Clock;
}
declare module '@link-foundation/ui-dom' {
  interface RenderOptions {
    data?: DataOptions;
  }
}
