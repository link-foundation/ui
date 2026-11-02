/**
 * Type declarations of `@link-foundation/ui-convert`.
 */

import type { Link } from 'links-notation';
import type {
  Diagnostic,
  UiDocument,
  Vocabulary,
} from '@link-foundation/ui-core';

/** UTF-16 offsets into the HTML text: `html.slice(start, end)`. */
export interface Span {
  start: number;
  end: number;
}

/** The intermediate form shared by `importHtml` and `importDom`. */
export interface HtmlNode {
  /** Lower-case tag name, `#text` or `#comment`. */
  tag: string;
  attrs: [string, string][];
  children: HtmlNode[];
  text?: string;
  span?: Span;
  /** The source node (a DOM `Node` or a parse5 node). */
  node?: unknown;
}

/** One rule of the mapping table (see `HTML_MAPPING`). */
export interface MappingRule {
  tags: string[];
  kind: string;
  /** For `input`: the accepted `type` values (missing type = `text`). */
  types?: string[];
  /** An attribute the element must have. */
  requires?: string;
  /** Where the text content goes: `'positional'` or a property name. */
  text?: string;
  /** Attribute name -> property name. */
  attrs?: Record<string, string>;
  /** The HTML tag the kind stands for; other tags keep `(tag ...)`. */
  tag?: string;
  level?: number;
}

/** `{ code: 'dropped-script', id, message }` plus a severity. */
export interface DroppedScriptDiagnostic {
  code: 'dropped-script';
  severity: 'warning';
  id: string;
  message: string;
}

export type ImportDiagnostic = DroppedScriptDiagnostic | Diagnostic;

export interface ImportOptions {
  /** Default: `htmlVocabulary()` (docs/spec/vocabulary.lino + `html`). */
  vocabulary?: Vocabulary;
  /** Default: `HTML_MAPPING`. */
  mapping?: readonly MappingRule[];
  /** Keep HTML comments as `comment` elements (default `false`). */
  comments?: boolean;
  /** Output style of `text` (default `multiline`). */
  style?: 'inline' | 'multiline' | 'indented';
  /** Indentation of `text` (default two spaces). */
  indent?: string;
}

export interface ImportHtmlOptions extends ImportOptions {
  /** Parse a whole document instead of a fragment (default `false`). */
  document?: boolean;
}

export interface ImportDomOptions extends ImportOptions {
  /** Source offsets of a DOM node, when the host knows them. */
  location?: (
    node: unknown
  ) =>
    | { start: number; end: number }
    | { startOffset: number; endOffset: number }
    | null
    | undefined;
}

export interface ImportResult {
  /** Links Notation text, formatted by `@link-foundation/ui-core`. */
  text: string;
  /** The projected element tree of `text`. */
  tree: UiDocument;
  /** The `Link` objects the text was formatted from. */
  links: Link[];
  /** Link id -> source span of the element. */
  spans: Map<string, Span>;
  diagnostics: ImportDiagnostic[];
}

export interface ImportDomResult extends ImportResult {
  /** Link id -> the original DOM node. */
  nodeMap: Map<string, unknown>;
}

export function importHtml(
  text: string,
  options?: ImportHtmlOptions
): ImportResult;
export function importDom(
  root: unknown,
  options?: ImportDomOptions
): ImportDomResult;

export const HTML_MAPPING: readonly MappingRule[];
export const HTML_FALLBACK_KIND: string;
export function ruleMatches(rule: MappingRule, node: HtmlNode): boolean;
export function findRule(
  node: HtmlNode,
  vocabulary: Vocabulary,
  table?: readonly MappingRule[]
): MappingRule | undefined;

/** Id of every node, in document order. */
export function assignIds(roots: HtmlNode[]): Map<HtmlNode, string>;
export function isValidId(value: string): boolean;

export function parseStyle(text: string): [string, string][];
export function styleLink(declarations: [string, string][]): Link | null;
export function collapseCss(text: string): string;

export const DROPPED_TAGS: string[];
export const SCRIPT_SCHEMES: string[];
export function hasScriptUrl(value: string): boolean;
export function isEventAttribute(name: string): boolean;

export const HTML_VOCABULARY_TEXT: string;
export function htmlVocabulary(): Vocabulary;
export function extendVocabulary(base: Vocabulary, text: string): Vocabulary;

export function readHtml(text: string, options?: ImportHtmlOptions): HtmlNode[];
export function readDom(root: unknown, options?: ImportDomOptions): HtmlNode[];
