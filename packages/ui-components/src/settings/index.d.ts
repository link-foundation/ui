import type {
  SettingField,
  SettingsSchema,
  SettingsValues,
} from '@link-foundation/ui-settings';
export interface SettingsTarget {
  values(): SettingsValues;
  update(values: SettingsValues): unknown;
  subscribe?(listener: (values: SettingsValues) => void): () => void;
}
export interface SettingsPanelOptions {
  document?: Document;
  values?: SettingsValues;
  target?: SettingsTarget;
  mode?: 'page' | 'drawer';
  label?: string;
  previewRoot?: HTMLElement;
  random?: () => number;
  confirmReset?: () => boolean;
  shareUrl?: string;
  onChange?: (values: SettingsValues, changed: SettingsValues) => void;
}
export function controlFor(field: SettingField): {
  element: string;
  props: Record<string, unknown>;
};
export function buildPanelModel(
  schema: SettingsSchema,
  values: SettingsValues,
  options?: { query?: string }
): {
  sections: {
    id: string;
    label?: string;
    description?: string;
    fields: SettingField[];
  }[];
  changedCount: number;
  activePreset?: string;
};
export function createSettingsPanel(
  schema: SettingsSchema,
  options?: SettingsPanelOptions
): {
  element: HTMLElement;
  values(): SettingsValues;
  update(changes: SettingsValues): void;
  open(trigger?: Element): void;
  close(): void;
  destroy(): void;
};
