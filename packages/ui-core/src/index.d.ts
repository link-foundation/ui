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

/** The edit ops of link-foundation/ui#16. */
export type SourceOp =
  | { op: 'insert'; parentId: string | null; index: number; node: UiNode }
  | { op: 'remove'; id: string }
  | { op: 'move'; id: string; parentId: string | null; index: number }
  | { op: 'setProp'; id: string; name: string; values: RawValue[] }
  | { op: 'removeProp'; id: string; name: string }
  | { op: 'rename'; id: string; to: string }
  | { op: 'setPositional'; id: string; values: string[] };

/**
 * The value layer (docs/spec/values.md): typed values, units, colours and
 * references, typed by the property types of the vocabulary.
 */
export namespace values {
  /** sRGB, gamma-encoded, every channel 0..1 (`#FFFFFF` is r = g = b = 1). */
  interface SrgbColor {
    type: 'color';
    space: 'srgb';
    r: number;
    g: number;
    b: number;
    a: number;
  }
  /** OKLCH: lightness 0..1, chroma, hue in degrees, alpha 0..1. */
  interface OklchColor {
    type: 'color';
    space: 'oklch';
    l: number;
    c: number;
    h: number;
    a: number;
  }
  type Color = SrgbColor | OklchColor;

  /** A value with its type; a bare `0` dimension has the unit `''`. */
  type TypedValue =
    | {
        type: 'dimension';
        value: number;
        unit: 'px' | 'rem' | 'em' | '%' | 'vw' | 'vh' | '';
      }
    | { type: 'duration'; value: number; unit: 'ms' | 's' }
    | Color
    | { type: 'token-ref'; path: string }
    | { type: 'element-ref'; id: string }
    | { type: 'param'; path: string }
    | { type: 'action'; name: string; args: TypedValue[] }
    | { type: 'fallback'; options: TypedValue[] }
    | { type: 'string' | 'enum' | 'url'; value: string }
    | { type: 'number'; value: number }
    | { type: 'boolean'; value: boolean }
    | { type: 'list'; items: TypedValue[]; id?: string };

  /** A vocabulary property type: `'dimension'`, `['enum', 'a', 'b']`. */
  type ValueType = string | RawValue[];

  interface ValueSpec {
    type: ValueType;
    multi?: boolean;
  }

  interface TypeOptions {
    /** Types the arguments of known actions (default: ui-dialect/0). */
    vocabulary?: Vocabulary;
    /** Where diagnostics point: `{ element, property }`. */
    at?: DiagnosticLocation;
  }

  /** `invalid-value` diagnostics also give the `expected` type as text. */
  interface ValueDiagnostic extends Diagnostic {
    expected?: string;
  }

  interface TypedResult {
    /** `null` when the value is invalid. */
    value: TypedValue | null;
    diagnostics: ValueDiagnostic[];
  }

  interface TypedUiProperty extends UiProperty {
    typed: (TypedValue | null)[];
  }

  interface TypedUiNode extends Omit<UiNode, 'properties' | 'children'> {
    typedPositional: (TypedValue | null)[];
    properties: TypedUiProperty[];
    children: TypedUiNode[];
  }

  interface CssOptions {
    /** CSS of a `token-ref` or `param`; default `var(--color-primary)`. */
    refToVar?: (ref: TypedValue, fallback?: string) => string;
  }

  /** Type one raw value with a property spec (default `{ type: 'any' }`). */
  function typeValue(
    raw: RawValue,
    spec?: ValueSpec,
    options?: TypeOptions
  ): TypedResult;
  /** Type every value of an element and its children. */
  function typeNode(
    node: UiNode,
    vocabulary?: Vocabulary,
    diagnostics?: Diagnostic[]
  ): TypedUiNode;
  function typeDocument(
    doc: Pick<UiDocument, 'roots'>,
    vocabulary?: Vocabulary
  ): { roots: TypedUiNode[]; diagnostics: ValueDiagnostic[] };
  function valueMatches(type: ValueType | undefined, value: RawValue): boolean;
  /** The type of a value when no property type is known. */
  function inferValue(raw: RawValue): TypedValue;

  /** Canonical Links Notation: `16px`, `'#6750A4'`, `(token a.b)`. */
  function formatValue(value: TypedValue): string;
  /** Read one value written by `formatValue`; throws on other input. */
  function parseValue(text: string): RawValue;
  /** CSS text; `null` for actions. */
  function toCss(value: TypedValue, options?: CssOptions): string | null;
  function toRaw(value: TypedValue): RawValue;
  function defaultRefToVar(ref: TypedValue, fallback?: string): string;

  function parseColor(raw: RawValue): Color | null;
  function formatColor(color: Color): string;
  function colorCss(color: Color): string;
  function oklchToSrgb(color: OklchColor): SrgbColor;
  function srgbToOklch(color: SrgbColor): OklchColor;
  /** Upper-case `#RRGGBB`, or `#RRGGBBAA` when not opaque. */
  function toHex(color: Color): string;

  /** `undefined` when not a reference, `null` when malformed. */
  function parseReference(
    raw: RawValue,
    typeOption: (option: RawValue) => TypedValue | null
  ): TypedValue | null | undefined;
  function isReference(raw: RawValue): boolean;
  function sigilDiagnostics(
    raw: RawValue,
    at?: DiagnosticLocation
  ): Diagnostic[];

  const DIMENSION_UNITS: readonly string[];
  const DURATION_UNITS: readonly string[];
  function isNumber(text: string): boolean;
  function isDimension(text: string): boolean;
  function isDuration(text: string): boolean;
  function isHexColour(text: string): boolean;
  function isUrl(text: string): boolean;
  function isTokenName(text: string): boolean;
  function hasReservedSigil(text: string): boolean;
  function parseNumber(text: string): number | null;
  function parseDimension(text: string): { value: number; unit: string } | null;
  function parseDuration(text: string): { value: number; unit: string } | null;
  function splitQuantity(
    text: string,
    units: readonly string[]
  ): { value: number; unit: string } | null;
}
