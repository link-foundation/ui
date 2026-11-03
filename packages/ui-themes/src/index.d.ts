import type { Theme } from '@link-foundation/ui-tokens/themes';
export function listThemes(): string[];
export function loadTheme(id: string): Promise<Theme>;

export function fluentBrandRamp(seed: string): Record<number, string>;
export function fluentThemeFromBrand(
  brand: Record<number, string> | string,
  options?: { id?: string }
): string;
export interface MappingRow {
  component: string;
  kind: string;
  status: 'mapped' | 'partial' | 'unsupported';
  props: { name: string; value: string; target: string[] }[];
  note: string;
}
export function loadMapping(text: string): MappingRow[];
export function mappingMarkdown(rows: MappingRow[]): string;
