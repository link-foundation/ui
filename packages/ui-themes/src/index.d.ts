import type { Theme } from '@link-foundation/ui-tokens/themes';
export function listThemes(): string[];
export function loadTheme(id: string): Promise<Theme>;
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
