/**
 * Type declarations of `@link-foundation/ui-core` (see src/types.js for the
 * same types as JSDoc).
 */

import type { Link } from 'links-notation';

/** A value: an atom is a string, a link without an id is an array. */
export type RawValue = string | RawValue[] | { id: string; values: RawValue[] };

export interface UiProperty {
  name: string;
  values: RawValue[];
}

/** One element, exactly as in docs/spec/element-tree.schema.json. */
export interface UiNode {
  /** `'ok'`, or `null` for an anonymous element. */
  id: string | null;
  /** The first value, e.g. `'button'`; `null` (with `missing-kind`) when absent. */
  kind: string | null;
  positional: string[];
  properties: UiProperty[];
  children: UiNode[];
  /** Sublinks the vocabulary does not know, kept verbatim. */
  unknown: RawValue[];
}

export interface DiagnosticLocation {
  line?: number;
  column?: number;
  element?: string | null;
  kind?: string;
  property?: string;
  head?: string | null;
  token?: string;
}

export interface Diagnostic {
  /** e.g. `syntax-error`, `duplicate-id`, `unknown-sublink` (docs/spec/limits.md) */
  code: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  at: DiagnosticLocation;
}

export interface UiDocument {
  spec: string;
  roots: UiNode[];
  /** Top-level links that are not elements. */
  unknown: RawValue[];
  /** Elements by id; on a duplicate id the first element is kept. */
  byId: Map<string, UiNode>;
  diagnostics: Diagnostic[];
}

export interface PropertySpec {
  type: RawValue;
  multi: boolean;
}

export interface KindSpec {
  positional: string[];
  properties: Map<string, PropertySpec>;
  children: string;
}

export interface Vocabulary {
  version: string | null;
  kinds: Map<string, KindSpec>;
  actions: Map<string, RawValue[][]>;
  multiValued: Set<string>;
}

export interface ParseOptions {
  /** How deep links may nest (default `DEFAULT_MAX_DEPTH`, 64). */
  maxDepth?: number;
  /** The largest accepted input in characters (default 1 MiB). */
  maxInputSize?: number;
  /** Default: docs/spec/vocabulary.lino. */
  vocabulary?: Vocabulary;
  /** `fold` path-folds `parse()`; `groups` and `auto` use `parseGroups()`. */
  mode?: 'auto' | 'fold' | 'groups';
  /** Value and behaviour checks (default `true`). */
  checks?: boolean;
}

export interface FormatOptions {
  /** Default `multiline`. */
  style?: 'inline' | 'multiline' | 'indented';
  /** Default two spaces. */
  indent?: string;
}

/** The element tree JSON of the spec fixtures. */
export interface UiTree {
  spec: string;
  elements: UiNode[];
  unknown?: RawValue[];
  diagnostics: { code: string; severity: string; at: DiagnosticLocation }[];
}

export const UI_DIALECT_VERSION: string;
export const SPEC_VERSION: string;
export const DEFAULT_MAX_DEPTH: number;
export const DEFAULT_MAX_INPUT_SIZE: number;

/** Parse Links Notation text into a UI document. Never throws. */
export function parse(text: string, options?: ParseOptions): UiDocument;

/** Like `parse`, but throws `UiParseError` when there is an error diagnostic. */
export function parseOrThrow(text: string, options?: ParseOptions): UiDocument;

export class UiParseError extends Error {
  diagnostics: Diagnostic[];
  document: UiDocument;
}

export function toTree(doc: UiDocument): UiTree;

/** Write a UI document as Links Notation text. */
export function format(doc: UiDocument, options?: FormatOptions): string;

/** One element as a single `Link` (the one-line form). */
export function elementLink(node: UiNode): Link;

/**
 * Visit every element depth-first, parents first; returning `false` skips
 * the children of that element.
 */
export function walk(
  root: UiDocument | UiNode,
  visitor: (
    node: UiNode,
    parent: UiNode | null,
    depth: number
  ) => boolean | void
): void;

/** Project one link into an element, or `null` when it is not an element. */
export function projectLink(
  link: Link,
  vocabulary: Vocabulary,
  diagnostics?: Diagnostic[]
): UiNode | null;

export function projectLinks(
  links: Link[],
  vocabulary: Vocabulary
): Pick<UiDocument, 'roots' | 'unknown' | 'byId' | 'diagnostics'>;

/** Read a vocabulary document (the shape of docs/spec/vocabulary.lino). */
export function loadVocabulary(text: string): Vocabulary;

/** The ui-dialect/0 vocabulary. */
export function defaultVocabulary(): Vocabulary;

/** Whether a value matches a vocabulary property type. */
export function valueMatches(
  type: RawValue | undefined,
  value: RawValue
): boolean;

/*
 * Source-preserving edits: the types of the `@link-foundation/ui-core/source`
 * subpath (declared in src/source.d.ts).
 */

/** Offsets `[start, end)` of a piece of the source text. */
export interface SourceSpan {
  start: number;
  end: number;
}

/** One node of the span tree of `indexSource`. */
export interface SpanNode extends SourceSpan {
  kind: 'document' | 'element' | 'prop' | 'value';
  /** Elements: the id (`null` when anonymous). */
  id?: string | null;
  /** Props: the property name. */
  name?: string;
  /** Values: a positional value, a property value, or an unknown link. */
  role?: 'positional' | 'value' | 'unknown';
  /** In source order. */
  children: SpanNode[];
  /** The blanks that start the node's line. */
  indent?: string;
  /** Whether only blanks come before the node on its line. */
  startsLine?: boolean;
  /** Elements: how the element is written. */
  form?: 'inline' | 'multiline' | 'indented';
  idSpan?: SourceSpan;
  kindSpan?: SourceSpan;
  nameSpan?: SourceSpan;
  /** Props: an earlier duplicate that a later one overrides. */
  shadowed?: boolean;
  /** Atoms: the reference text. */
  text?: string;
}

/** One text replacement, in offsets of the input. */
export interface SourceEdit extends SourceSpan {
  insert: string;
}

export type SourceEditResult =
  | { ok: true; text: string; edits: SourceEdit[]; references?: SourceSpan[] }
  | { ok: false; error: string; text: string };

/** The edit ops of issue #16. */
export type SourceOp =
  | { op: 'insert'; parentId: string | null; index: number; node: UiNode }
  | { op: 'remove'; id: string }
  | { op: 'move'; id: string; parentId: string | null; index: number }
  | { op: 'setProp'; id: string; name: string; values: RawValue[] }
  | { op: 'removeProp'; id: string; name: string }
  | { op: 'rename'; id: string; to: string }
  | { op: 'setPositional'; id: string; values: string[] };
