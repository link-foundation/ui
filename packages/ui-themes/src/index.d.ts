import type { Theme } from '@link-foundation/ui-tokens/themes';
export function listThemes(): string[];
export function loadTheme(id: string): Promise<Theme>;

export interface MappingRow {
  name: string;
  kind: string;
  status: 'mapped' | 'partial' | 'none';
  props: { property: string; value: string; target: string[] }[];
}
export function readMapping(text: string): MappingRow[];
export function getSwiftuiMapping(): Promise<MappingRow[]>;
