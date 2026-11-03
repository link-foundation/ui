import type { Theme } from '@link-foundation/ui-tokens/themes';
export function listThemes(): string[];
export function loadTheme(id: string): Promise<Theme>;

export function fluentBrandRamp(seed: string): Record<number, string>;
export function fluentThemeFromBrand(
  brand: Record<number, string> | string,
  options?: { id?: string }
): string;
export interface FluentMappingRow {
  component: string;
  kind: string | null;
  status: 'mapped' | 'partial' | 'unsupported' | 'none';
  props: { name: string; value: string; target: string[] }[];
  note: string;
}
export function loadMapping(text: string): FluentMappingRow[];
export function mappingMarkdown(rows: FluentMappingRow[]): string;

export function materialThemeFromSeed(
  seed: string,
  options?: {
    id?: string;
    contrast?: number;
    variant?: 'tonal-spot' | 'vibrant' | 'neutral';
  }
): string;
export function muiThemeToLino(
  themeOptions: object,
  options?: { id?: string }
): {
  lino: string;
  unmapped: string[];
};
export interface MuiMappingRow {
  component: string;
  kind: string | null;
  status: 'mapped' | 'partial' | 'none';
  props: Array<{
    name: string;
    value: string;
    target: { name: string; value: string };
  }>;
}
export function getMuiMapping(): Promise<MuiMappingRow[]>;

export interface MappingRow {
  name: string;
  kind: string | null;
  status: 'mapped' | 'partial' | 'none';
  props: { property: string; value: string; target: string[] }[];
}
export function readMapping(text: string): MappingRow[];
export function getSwiftuiMapping(): Promise<MappingRow[]>;
