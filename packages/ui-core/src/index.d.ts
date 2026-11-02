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
