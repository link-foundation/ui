import type { Diagnostic, RawValue, values } from '@link-foundation/ui-core';

export type { Diagnostic };

/** The token types: DTCG 2025.10 primitives and composites. */
export type TokenType =
  | 'color'
  | 'dimension'
  | 'duration'
  | 'number'
  | 'fontFamily'
  | 'fontWeight'
  | 'cubicBezier'
  | 'shadow'
  | 'typography';

export type TokenRef = { type: 'token-ref'; path: string };
export type ColorValue = Extract<values.TypedValue, { type: 'color' }>;
export type DimensionValue = {
  type: 'dimension';
  value: number;
  unit: 'px' | 'rem';
};
export type DurationValue = {
  type: 'duration';
  value: number;
  unit: 'ms' | 's';
};

export interface ShadowLayer {
  color: ColorValue | TokenRef;
  offsetX: DimensionValue | TokenRef;
  offsetY: DimensionValue | TokenRef;
  blur: DimensionValue | TokenRef;
  spread: DimensionValue | TokenRef;
  inset?: boolean;
}

export interface TypographyValue {
  fontFamily: FontFamilyValue | TokenRef;
  fontSize: DimensionValue | TokenRef;
  fontWeight: FontWeightValue | TokenRef;
  letterSpacing: DimensionValue | TokenRef;
  lineHeight: { type: 'number'; value: number } | TokenRef;
}

export type FontFamilyValue = { type: 'fontFamily'; value: string | string[] };
export type FontWeightValue = { type: 'fontWeight'; value: number | string };

/** A token value; after resolution no `token-ref` is left in `value`. */
export type TokenValue =
  | TokenRef
  | ColorValue
  | DimensionValue
  | DurationValue
  | { type: 'number'; value: number }
  | FontFamilyValue
  | FontWeightValue
  | { type: 'cubicBezier'; value: [number, number, number, number] }
  | { type: 'shadow'; value: ShadowLayer | (ShadowLayer | TokenRef)[] }
  | { type: 'typography'; value: TypographyValue };

export interface Token {
  path: string;
  /** `null` for an alias without `(type ...)`. */
  type: TokenType | null;
  value: TokenValue;
  description?: string;
  m3?: string;
  mode?: string;
}

export interface TokenSet {
  id: string;
  extends: string[];
  tokens: Token[];
  modes: Record<string, Token[]>;
}

export interface ResolvedToken {
  path: string;
  type: TokenType;
  /** Fully resolved: no alias left. */
  value: TokenValue;
  /** As written, aliases kept. */
  raw: TokenValue;
  /** The target of a whole-token alias. */
  alias?: string;
  description?: string;
  m3?: string;
  /** The set that defines the token. */
  set: string;
  /** The mode whose override defines the token. */
  mode?: string;
}

export type ResolvedTokens = Map<string, ResolvedToken> & {
  setId: string;
  mode: string | null;
  /** Per other mode, the tokens that resolve differently in it. */
  modes: Map<string, Map<string, ResolvedToken>>;
  diagnostics: Diagnostic[];
};

export const TOKEN_TYPES: readonly TokenType[];
export const FONT_WEIGHTS: Readonly<Record<string, number>>;
export const DIMENSION_UNITS: readonly ['px', 'rem'];
export const COMPOSITE_FIELDS: Readonly<
  Record<
    'shadow' | 'typography',
    readonly (readonly [string, string, TokenType])[]
  >
>;
/** The `$extensions` key under which `toDtcg` writes modes. */
export const DTCG_EXTENSION: string;

/** Read every token set (`theme` element) of a Links Notation text. */
export function readTokens(text: string): {
  sets: Map<string, TokenSet>;
  diagnostics: Diagnostic[];
};

/** Whether `path` can name a token (DTCG 2025.10 section 5.1.1). */
export function isTokenPath(path: unknown): boolean;

/** Resolve extends, then mode overrides, then aliases. */
export function resolveTokens(
  sets: Map<string, TokenSet>,
  setId: string,
  options?: { mode?: string | null }
): ResolvedTokens;

export interface CssOptions {
  selector?: string;
  prefix?: string;
  modeSelector?: (mode: string) => string;
  modeMedia?: Record<string, string>;
}
export function toCss(resolved: ResolvedTokens, options?: CssOptions): string;

export function toDtcg(
  resolved: ResolvedTokens,
  options?: { keepAliases?: boolean }
): Record<string, unknown>;

export function fromDtcg(
  json: string | Record<string, unknown>,
  options?: { id?: string }
): string;

export function toSwift(
  resolved: ResolvedTokens,
  options?: { name?: string }
): string;

export function toKotlin(
  resolved: ResolvedTokens,
  options?: { packageName?: string; name?: string }
): string;

/** `color.on-primary` -> `--color-on-primary` (`--PREFIX-...` with a prefix). */
export function cssVariable(path: string, prefix?: string): string;

/** Type a raw token value; `null` when it is not of the declared type. */
export function typeTokenValue(
  raw: RawValue,
  declared?: TokenType
): TokenValue | null;

/** A token value as the raw Links Notation value it is written as. */
export function tokenValueRaw(value: TokenValue): RawValue;
