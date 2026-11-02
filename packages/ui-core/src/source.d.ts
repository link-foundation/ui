/**
 * Type declarations of `@link-foundation/ui-core/source`.
 */

import type { Link } from 'links-notation';
import type {
  RawValue,
  SourceEdit,
  SourceEditResult,
  SourceOp,
  SourceSpan,
  SpanNode,
  UiDocument,
  UiNode,
  Vocabulary,
} from '@link-foundation/ui-core';

export type {
  SourceEdit,
  SourceEditResult,
  SourceOp,
  SourceSpan,
  SpanNode,
} from '@link-foundation/ui-core';

export interface SourceOptions {
  vocabulary?: Vocabulary;
}

export interface DelimiterToken extends SourceSpan {
  type: 'open' | 'close' | 'colon' | 'reference' | 'break';
  quoted?: boolean;
  indent?: number;
}

/** The delimiters of `stripComments(text)`, found without regular expressions. */
export function scanDelimiters(stripped: string): {
  tokens: DelimiterToken[];
  lineStarts: number[];
  indents: number[];
};

/** The end of the quoted reference opened at `start`, or `null`. */
export function quotedEnd(text: string, start: number): number | null;

/** Thrown when a span cannot be confirmed by the official parser. */
export class SourceIndexError extends Error {
  path?: string;
}

/** Thrown inside an edit that cannot be made (reported as `ok: false`). */
export class SourceEditError extends Error {}

/** The span tree of a document, every span checked against the parser. */
export function indexSource(
  text: string,
  options?: SourceOptions
): {
  root: SpanNode;
  form: 'inline' | 'multiline' | 'indented';
  document: UiDocument;
  unit: string;
};

/** The first element span with `id`, in document order. */
export function findElement(
  root: SpanNode,
  id: string
): { node: SpanNode; parent: SpanNode } | null;

/** Fold the path links of a multi-line group back into one link. */
export function normalizeLink(link: Link): Link;

export function setProp(
  text: string,
  id: string,
  name: string,
  values: RawValue[],
  options?: SourceOptions
): SourceEditResult;
export function removeProp(
  text: string,
  id: string,
  name: string,
  options?: SourceOptions
): SourceEditResult;
export function setPositional(
  text: string,
  id: string,
  values: string[],
  options?: SourceOptions
): SourceEditResult;
export function insertChild(
  text: string,
  parentId: string | null,
  index: number,
  childLino: string,
  options?: SourceOptions
): SourceEditResult;
export function removeNode(
  text: string,
  id: string,
  options?: SourceOptions
): SourceEditResult;
export function moveNode(
  text: string,
  id: string,
  parentId: string | null,
  index: number,
  options?: SourceOptions
): SourceEditResult;
/** Changes the definition only; `references` lists the other uses. */
export function renameId(
  text: string,
  from: string,
  to: string,
  options?: SourceOptions
): SourceEditResult;

/** Apply edits given in offsets of `text`. */
export function applyEdits(text: string, edits: SourceEdit[]): string;

/** The error when `newText` is not the tree `op` gives, otherwise `null`. */
export function checkEdit(
  oldDocument: UiDocument,
  newText: string,
  op: SourceOp,
  options?: SourceOptions
): string | null;

/** Apply ops in order; all or nothing. */
export function applyOpsToSource(
  text: string,
  ops: SourceOp[],
  options?: SourceOptions
):
  | {
      ok: true;
      text: string;
      steps: Array<{ op: SourceOp; edits: SourceEdit[] }>;
    }
  | { ok: false; error: string; index: number; text: string };

/** Apply one op to a copy of a document tree. */
export function applyOpToTree(
  doc: Pick<UiDocument, 'roots' | 'unknown'>,
  op: SourceOp
):
  | { ok: true; tree: { roots: UiNode[]; unknown: RawValue[] } }
  | { ok: false; error: string };

export const OP_NAMES: string[];
