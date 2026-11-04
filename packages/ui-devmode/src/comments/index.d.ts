/// <reference lib="dom" />
import type { UiDocument } from '@link-foundation/ui-core';
export interface CommentTask {
  id: string;
  target: string;
  kind: string;
  revision: string;
  instruction: string;
  input: 'text' | 'voice';
  status: 'open' | 'resolved';
}
export interface CommentRevision {
  id: string;
  source: string;
}
export interface CommentEvent extends CommentTask {
  action: 'create' | 'update' | 'remove';
}
export interface CommentData {
  revisions: CommentRevision[];
  tasks: CommentTask[];
  events: CommentEvent[];
}
export interface CommentTree {
  get(id: string): object | undefined;
  roots(): string[];
  children(id: string): string[];
  toDocument(): UiDocument;
  subscribe?(listener: () => void): () => void;
}
export interface CommentModel {
  tasks(): CommentTask[];
  revisions(): CommentRevision[];
  events(): CommentEvent[];
  export(): string;
  import(text: string): void;
  subscribe(listener: () => void): () => void;
  add(
    ids: Iterable<string>,
    instruction: string,
    input?: 'text' | 'voice'
  ): CommentTask[];
  update(
    id: string,
    patch: Partial<Pick<CommentTask, 'instruction' | 'status'>>
  ): void;
  remove(id: string): void;
  state(id: string): 'current' | 'outdated' | 'missing';
}
export const COMMENT_LIMITS: Readonly<{
  size: number;
  tasks: number;
  revisions: number;
  events: number;
  instruction: number;
}>;
export function readComments(text: string): CommentData;
export function commentDocument(tree: CommentTree): UiDocument;
export function createComments(options: {
  getDocument: () => UiDocument;
  text?: string;
  trace?: (event: string, detail: CommentEvent) => void;
}): CommentModel;
export interface MountCommentsOptions {
  root: Element;
  tree: CommentTree;
  nodeFor(id: string): Element | null;
  observe?(listener: () => void): () => void;
  container?: Node;
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  storageKey?: string;
  text?: string;
  messages?: Record<string, string>;
  trace?: (event: string, detail: CommentEvent) => void;
  onClose?: () => void;
}
export function mountComments(options: MountCommentsOptions): {
  host: HTMLElement;
  model: CommentModel;
  tree: CommentTree;
  select(ids: Iterable<string>): void;
  selection(): string[];
  refresh(): void;
  destroy(): void;
};
export interface Point {
  x: number;
  y: number;
}
export function lasso(
  rects: (Point & { id: string; width: number; height: number })[],
  polygon: Point[]
): string[];
