import type {
  Diagnostic,
  RawValue,
  UiNode,
  values,
} from '@link-foundation/ui-core';

export type { Diagnostic };
export type TypedValue = values.TypedValue;

/** The interaction states (Material 3 state names). */
export type StateName =
  | 'hover'
  | 'focus'
  | 'pressed'
  | 'disabled'
  | 'selected'
  | 'checked';

/** `(type KIND) (id ID) (PROP VALUE) (within SELECTOR...)`. */
export interface Selector {
  type: string | null;
  id: string | null;
  props: { name: string; value: string }[];
  /** Ancestors, each matched by some ancestor of the element. */
  within: Selector[];
}

export interface Decl {
  property: string;
  /** Typed; several values (`(padding 8px 16px)`) are a `list`. */
  value: TypedValue;
}

export interface Condition {
  feature:
    | 'min-width'
    | 'max-width'
    | 'prefers-color-scheme'
    | 'prefers-reduced-motion';
  /** A dimension (px, rem, em) or an `enum`. */
  value: TypedValue;
}

export type Block =
  | { kind: 'state'; condition: StateName; rule: StyleRule }
  | { kind: 'media' | 'container'; condition: Condition[]; rule: StyleRule };

export interface StyleRule {
  id: string;
  /** The position of the rule in the input. */
  order: number;
  selector: Selector;
  declarations: Decl[];
  blocks: Block[];
}

/** One rule or block flattened in the order `compileCss` writes it. */
export interface Entry {
  id: string;
  index: number;
  selector: Selector;
  states: StateName[];
  at: { kind: 'media' | 'container'; conditions: Condition[] }[];
  declarations: Decl[];
}

export interface StyleEnv {
  states?: string[];
  /** Without a width, no width media condition holds. */
  viewport?: { width: number };
  /** Without a width, no container condition holds. */
  container?: { width: number };
  /** Default `light`. */
  colorScheme?: 'light' | 'dark';
  /** Default `false`. */
  reducedMotion?: boolean;
}

export interface PropertySpec {
  css: string;
  type: string | string[];
  max?: number;
  tokens: string[];
  check?: (value: TypedValue) => boolean;
  write?: (value: TypedValue, ctx: CssContext) => string;
  expected?: string;
}

export interface CssContext {
  refToVar: (ref: TypedValue, fallback?: string) => string;
  variable: (path: string) => string;
}

export interface CompileOptions {
  /** Default `(kind) => 'ui-' + kind` (escaped); the result is used verbatim. */
  tagFor?: (kind: string) => string;
  /** The custom property prefix of ui-tokens `toCss`. */
  prefix?: string;
}

/** Read every `style` element of a Links Notation text. Never throws. */
export function readStyles(text: string): {
  rules: StyleRule[];
  diagnostics: Diagnostic[];
};

/** The first CSS syntax (`a:b`, `(id: ...)`) in a raw value, or `null`. */
export function findCssSyntax(raw: RawValue): string | null;

/** Whether `node` matches; `ancestors` go from the root to the parent. */
export function matches(
  selector: Selector,
  node: UiNode,
  ancestors?: UiNode[]
): boolean;

/** `[ids, props + states, types]`. */
export function specificity(
  selector: Selector,
  states?: number
): [number, number, number];

export function compareSpecificity(
  a: readonly number[],
  b: readonly number[]
): number;

export function flatten(rules: StyleRule[]): Entry[];

/**
 * The style of one element in a state and environment; `sources` gives the
 * id of the rule that won each property (R12).
 */
export function resolveStyle(
  rules: StyleRule[],
  tokens: Map<string, unknown>,
  node: UiNode,
  ancestors?: UiNode[],
  env?: StyleEnv
): {
  style: Record<string, TypedValue>;
  sources: Record<string, string>;
  diagnostics: Diagnostic[];
};

/** The rules as a CSS stylesheet. */
export function compileCss(
  rules: StyleRule[],
  options?: CompileOptions
): string;

/** `CSS.escape`. */
export function escapeIdentifier(text: string): string;
/** A single-quoted, escaped CSS string. */
export function quoteString(text: string): string;

export const PROPERTIES: Readonly<Record<string, PropertySpec>>;
export function isStyleProperty(name: string): boolean;
export function typeDeclaration(
  name: string,
  raws: RawValue[],
  at: Record<string, unknown>,
  diagnostics: Diagnostic[]
): Decl | null;
export function declarationCss(decl: Decl, ctx: CssContext): string;

export const STATES: readonly StateName[];
export const STATE_CSS: Readonly<Record<StateName, string>>;
export const FEATURES: Readonly<
  Record<'media' | 'container', Record<string, { type: string | string[] }>>
>;
/** The font size that `rem` and `em` widths are resolved with (16). */
export const ROOT_FONT_SIZE: number;
export function conditionHolds(
  kind: 'media' | 'container',
  condition: Condition,
  env: StyleEnv
): boolean;
