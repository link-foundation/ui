import type {
  TokenValue,
  TokenSet,
  ResolvedTokens,
} from '@link-foundation/ui-tokens';
import type { StyleRule } from '@link-foundation/ui-style';
export interface ThemeDiagnostic {
  code: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  at: Record<string, unknown>;
}
export interface TemplateNode {
  name: string;
  kind: string;
  children: TemplateNode[];
}
export interface Theme {
  id: string;
  extends: string[];
  tokens: Map<string, TokenValue>;
  modes: Record<string, Map<string, TokenValue>>;
  styles: StyleRule[];
  templates: Map<string, TemplateNode>;
  forcedColors: Map<string, string>;
  pairs: [string, string, number?][];
  springs?: Record<string, { response: number; damping: number }>;
  defaults: Partial<
    Record<'motion' | 'sound' | 'volume' | 'transparency' | 'menu', string>
  >;
  diagnostics: ThemeDiagnostic[];
  set: TokenSet;
  sets?: Map<string, TokenSet>;
  chain?: Theme[];
}
export function loadThemes(text: string): {
  themes: Theme[];
  diagnostics: ThemeDiagnostic[];
};
export function resolveTheme(registry: Map<string, Theme>, id: string): Theme;
export function resolveThemeTokens(
  theme: Theme,
  modes?: string[]
): ResolvedTokens;
export function contrastRatio(
  fg: string | TokenValue,
  bg: string | TokenValue
): number;
export function ensureContrast(
  on: string | TokenValue,
  fill: string | TokenValue,
  min?: number
): { color: string; adjusted: boolean; ratio: number };
export interface ThemeCssOptions {
  transparency?: 'on' | 'off';
  reducedTransparency?: boolean;
  prefix?: string;
  strict?: boolean;
  minContrast?: number;
  diagnostics?: ThemeDiagnostic[];
  onDiagnostic?: (diagnostic: ThemeDiagnostic) => void;
}
export function compileThemeCss(
  theme: Theme,
  options?: ThemeCssOptions
): string;
export function resolveTemplate(
  themeChain: Theme | Theme[],
  kind: string
): TemplateNode | null;
export function themeBootScript(options?: { storageKey?: string }): string;
export function exportThemeResolver(theme: Theme): Record<string, unknown>;
