import type { Theme } from '@link-foundation/ui-tokens/themes';
export function listThemes(): string[];
export function loadTheme(id: string): Promise<Theme>;
