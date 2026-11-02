/**
 * Type declarations of `@link-foundation/ui-convert`.
 */

import type { Link } from 'links-notation';
import type {
  Diagnostic,
  DiagnosticLocation,
  RawValue,
  UiDocument,
  UiNode,
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

export function mapHtmlElement(
  node: HtmlNode,
  children: HtmlNode[],
  attrs: [string, string][],
  vocabulary: Vocabulary,
  table?: readonly MappingRule[]
): { head: Link[]; attrs: [string, string][]; children: HtmlNode[] } | null;

// ---------------------------------------------------------------------------
// Components: JSX / TSX and Vue single-file components, mapped to dialect
// kinds by LiNo match / replace rules (src/mappings/mui.lino).
// ---------------------------------------------------------------------------

/** A term of the rule engine: an atom or a link of terms. */
export type Term = string | Term[];

/** A match / replace rule read from Links Notation. */
export interface Rule {
  name: string;
  match: Term[];
  replace: Term[];
}

export function readRules(text: string): Rule[];
export function matchTerm(
  pattern: Term,
  term: Term,
  bindings?: Map<string, Term>
): Map<string, Term> | null;
export function matchElement(
  pattern: Term[],
  element: Term[]
): { bindings: Map<string, Term>; consumed: Term[]; rest: Term[] } | null;
export function substitute(
  term: Term,
  bindings: Map<string, Term>
): Term | undefined;
export function applyRules(
  element: Term[],
  rules: Rule[]
): { node: Term[]; applied: string[]; consumed: Term[]; rest: Term[] };

/** The built-in mappings: `['mui']`. */
export const MAPPINGS: readonly string[];
export const COMPONENT_VOCABULARY_TEXT: string;
/** The vocabulary of documents imported from JSX and Vue. */
export function componentVocabulary(): Vocabulary;
export function mappingRules(name: string): Rule[];
/** Built-in mapping names or rule file texts, first match wins. */
export function loadMappings(mappings: string[]): Rule[];

export interface ComponentDiagnostic {
  code: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  /** The source text range of the construct. */
  span?: Span;
  /** The id of the link that carries it (`null`: the document). */
  id: string | null;
}

export interface ImportComponentOptions {
  /** Mapping names (`'mui'`) or rule file texts; default `['mui']`. */
  mappings?: string[];
  /** Default: `componentVocabulary()`. */
  vocabulary?: Vocabulary;
  /** Output style of `text` (default `multiline`). */
  style?: 'inline' | 'multiline' | 'indented';
  indent?: string;
}

export interface ImportComponentResult {
  text: string;
  tree: UiDocument;
  links: Link[];
  /** Link id -> source span. */
  spans: Map<string, Span>;
  /** Link id -> the name of the mapping rule that produced it. */
  applied: Map<string, string>;
  diagnostics: (ComponentDiagnostic | Diagnostic)[];
}

export interface JsxProp {
  name: string | null;
  kind: 'literal' | 'identifier' | 'expression' | 'spread';
  value?: string;
  source: string;
  span: Span;
  expression?: unknown;
}

export interface JsxNode extends HtmlNode {
  props?: JsxProp[];
}

export function parseJsx(
  text: string,
  options?: { typescript?: boolean }
): JsxNode & { errors: { message: string; span: Span }[] };
export function cleanJsxText(text: string): string;
export function importJsx(
  text: string,
  options?: ImportComponentOptions & { typescript?: boolean }
): ImportComponentResult;

export interface VueProp {
  kind: 'attribute' | 'directive';
  name: string;
  rawName: string;
  value?: string;
  arg?: string;
  dynamicArg?: boolean;
  exp?: string;
  modifiers?: string[];
  alias?: string[];
  iterable?: string;
  source: string;
  span: Span;
}

export interface VueNode extends HtmlNode {
  props?: VueProp[];
  component?: boolean;
}

export interface VueBlock {
  tag: string;
  attrs: [string, string][];
  content: string;
  span: Span;
}

export function parseVue(text: string): {
  template: VueNode;
  script: VueBlock[];
  styles: VueBlock[];
  blocks: VueBlock[];
  errors: { message: string; span: Span }[];
};
export function importVue(
  text: string,
  options?: ImportComponentOptions
): ImportComponentResult;

export function importComponents(
  roots: unknown[],
  options?: ImportComponentOptions
): ImportComponentResult;

export function literalText(expression: unknown): string | undefined;
export function pathText(expression: unknown): string | undefined;
export function styleDeclarations(
  expression: unknown,
  options?: { px?: boolean }
): [string, string][] | null;
export function cssName(key: string): string;
export function eventName(name: string): string;
export function jsxEvent(prop: string): string | null;

// ---------------------------------------------------------------------------
// Interop: A2UI, Adaptive Cards, JSON Forms and Lottie.
//
// Every converter reports the same diagnostic type as the HTML importer and
// `@link-foundation/ui-core`: `{ code, severity, message, at }`. `at` also
// names the format and the JSON path (or the element id) it is about.
// ---------------------------------------------------------------------------

export type InteropFormat = 'a2ui' | 'adaptive-cards' | 'json-forms' | 'lottie';

export interface InteropDiagnosticLocation extends DiagnosticLocation {
  format?: string;
  /** JSON Pointer into the input (or the output, on export). */
  path?: string;
  [key: string]: unknown;
}

export interface InteropDiagnostic extends Diagnostic {
  at: InteropDiagnosticLocation;
}

/** Collects the diagnostics of one conversion. */
export class Diagnostics {
  constructor(format: string);
  format: string;
  list: InteropDiagnostic[];
  add(
    code: string,
    severity: 'error' | 'warning' | 'info',
    message: string,
    at?: Omit<InteropDiagnosticLocation, 'format'>
  ): void;
  error(code: string, message: string, at?: object): void;
  warning(code: string, message: string, at?: object): void;
  info(code: string, message: string, at?: object): void;
}

export interface InteropImportOptions {
  /** Output style of `lino` (default `multiline`). */
  style?: 'inline' | 'multiline' | 'indented';
}

export interface InteropImportResult {
  /** Links Notation text in the UI dialect. */
  lino: string;
  /** The ui-core element tree of `lino`. */
  roots: UiNode[];
  diagnostics: InteropDiagnostic[];
}

export interface InteropExportResult<T> {
  /** `null` when nothing could be exported (see the diagnostics). */
  json: T | null;
  diagnostics: InteropDiagnostic[];
}

/** LiNo text or a parsed document. */
export type InteropSource = string | { roots: UiNode[] };

export interface InteropExportOptions {
  /** The element to export (by default the first document). */
  id?: string;
  /** Adaptive Cards only: the card version to write. */
  targetVersion?: string;
}

export const FORMATS: InteropFormat[];
export function detectFormat(json: unknown): InteropFormat | null;
export const CONVERTERS: Record<
  InteropFormat,
  {
    import(json: unknown, options?: InteropImportOptions): InteropImportResult;
    export(
      doc: InteropSource,
      options?: InteropExportOptions
    ): InteropExportResult<unknown>;
  }
>;

/** The vocabulary of the UI dialect with the interop kinds and properties. */
export function interopVocabulary(): Vocabulary;

/** `(extra <format> '<json>')`: input keys a format has no mapping for. */
export function encodeAny(value: unknown): string;
export function decodeAny(raw: RawValue): unknown;
export function extraProperty(
  format: string,
  rest: Record<string, unknown>
): unknown;
export function readExtra(
  node: { properties: { name: string; values: unknown[] }[] },
  format: string
): Record<string, unknown>;

// A2UI

/** A2UI messages: an array, a `{ messages }` sample or JSON Lines text. */
export type A2uiMessages = object[] | { messages: object[] } | string;

export interface A2uiDiffProps {
  positional: string[];
  properties: object[];
}

export interface A2uiDiff {
  op: 'insert' | 'set' | 'remove';
  id: string;
  parent?: string;
  index?: number;
  kind?: string;
  props?: A2uiDiffProps;
}

export interface A2uiDiffResult {
  diffs: A2uiDiff[];
  diagnostics: InteropDiagnostic[];
}

export const A2UI_VERSION: string;
export const SUPPORTED_VERSIONS: string[];
export function importA2ui(
  messages: A2uiMessages,
  options?: InteropImportOptions
): InteropImportResult;
export function exportA2ui(
  doc: InteropSource,
  options?: { id?: string }
): InteropExportResult<object[]>;
export function normalizeA2ui(messages: A2uiMessages): object[];
export function a2uiMessagesToDiffs(messages: A2uiMessages): A2uiDiffResult;
export function applyA2uiDiffs(roots: UiNode[], diffs: A2uiDiff[]): UiNode[];
export function diffTrees(before: UiNode[], after: UiNode[]): A2uiDiff[];

/** Push A2UI messages one at a time and get the diffs each one makes. */
export class A2uiStream {
  tree: UiNode[];
  push(message: unknown): A2uiDiffResult;
  allDiagnostics(): InteropDiagnostic[];
}

// Adaptive Cards

export const ADAPTIVE_CARDS_VERSION: string;
export function importAdaptiveCard(
  json: unknown,
  options?: InteropImportOptions
): InteropImportResult;
export function exportAdaptiveCard(
  doc: InteropSource,
  options?: { id?: string; targetVersion?: string }
): InteropExportResult<object>;
/** A host config colour (`#RGB`, `#RRGGBB`, `#AARRGGBB`) or `null`. */
export function hostColour(text: unknown): string | null;
/** An Adaptive Cards host config as a `theme` element (LiNo text). */
export function hostConfigToTheme(
  hostConfig: unknown,
  options?: { id?: string }
): string;
export function hostConfigToThemeDetails(
  hostConfig: unknown,
  options?: { id?: string }
): {
  lino: string;
  tokens: Map<string, string>;
  unmapped: string[];
  diagnostics: InteropDiagnostic[];
};

// JSON Forms

export interface JsonForm {
  schema?: object;
  uischema?: object;
  [key: string]: unknown;
}

export const JSON_FORMS_VERSION: string;
export function importJsonForms(
  form: JsonForm,
  options?: InteropImportOptions
): InteropImportResult;
export function exportJsonForms(
  doc: InteropSource,
  options?: { id?: string }
): InteropExportResult<{ schema?: object; uischema: object }>;
export function normalizeJsonForms<T>(form: T): T;
/** `#/properties/a/properties/b` -> `a.b` (other scopes are kept). */
export function scopeToBind(scope: string): string;
export function bindToScope(bind: string): string;

// Lottie

export interface LottieBezier {
  c: boolean;
  v: number[][];
  i: number[][];
  o: number[][];
}

export const LOTTIE_VERSION: string;
export function importLottie(
  json: unknown,
  options?: InteropImportOptions
): InteropImportResult;
export function normalizeLottie<T>(json: T): T;
/** Exports a document, an animation or a shape (by default the first). */
export function exportLottie(
  doc: InteropSource,
  id?: string
): InteropExportResult<object>;
export function svgToBezier(text: string): LottieBezier | null;
export function encodePath(bezier: unknown): string;
export function decodePath(text: unknown): LottieBezier | null;
