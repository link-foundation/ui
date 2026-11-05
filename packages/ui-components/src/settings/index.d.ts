import type {
  SettingField,
  SettingsSchema,
  SettingsValues,
  SettingsProjection,
  SettingsSection,
} from '@link-foundation/ui-settings';
export interface SettingsTarget {
  values(): SettingsValues;
  update(values: SettingsValues): unknown;
  subscribe?(listener: (values: SettingsValues) => void): () => void;
}
export interface PanelModelOptions {
  query?: string;
  tabs?: Record<string, string>;
  level?: string;
  includeAll?: boolean;
}
export interface PanelModel {
  sections: (SettingsSection & { fields: SettingField[] })[];
  visibleCount: number;
  changedCount: number;
  activePreset?: string;
}
export interface FieldControl {
  update(value: unknown): void;
  destroy(): void;
}
export interface SettingsPanelOptions extends PanelModelOptions {
  document?: Document;
  values?: SettingsValues;
  target?: SettingsTarget;
  mode?: 'page' | 'drawer';
  label?: string;
  previewRoot?: HTMLElement;
  project?: SettingsProjection;
  onPreview?: (values: SettingsValues, root: HTMLElement) => void;
  columns?: number;
  random?: () => number;
  randomLocked?: Iterable<string>;
  confirmReset?: () => boolean;
  shareUrl?: string;
  sharedHash?: string;
  savedLooks?: Record<string, SettingsValues>;
  onLooksChange?: (looks: Record<string, SettingsValues>) => void;
  formatCount?: (model: PanelModel) => string;
  normalizeChanges?: (
    values: SettingsValues,
    changes: SettingsValues
  ) => SettingsValues;
  mountControl?: (
    container: HTMLElement,
    field: SettingField,
    value: unknown,
    onChange: (value: unknown) => void,
    id: string
  ) => FieldControl;
  mountPreview?: (context: {
    container: HTMLElement;
    field: SettingField;
    values: SettingsValues;
  }) => {
    update(values: SettingsValues, field: SettingField): void;
    destroy?(): void;
  };
  codec?: {
    read(
      text: string,
      options?: { base?: SettingsValues }
    ): {
      ok: boolean;
      values: SettingsValues;
      rejected: string[];
      diagnostics?: { severity: string }[];
    };
    write(values: SettingsValues): string;
  };
  onChange?: (values: SettingsValues, changed: SettingsValues) => void;
}
export function controlFor(field: SettingField): {
  element: string;
  props: Record<string, unknown>;
};
export function buildPanelModel(
  schema: SettingsSchema,
  values: SettingsValues,
  options?: PanelModelOptions
): PanelModel;
export function createSettingsPanel(
  schema: SettingsSchema,
  options?: SettingsPanelOptions
): {
  element: HTMLElement;
  values(): SettingsValues;
  update(changes: SettingsValues): void;
  setTab(section: string, tab: string): void;
  setLevel(level?: string): void;
  saveLook(name: string): void;
  applyLook(name: string): void;
  applyShared(
    hash: string
  ): ReturnType<typeof import('@link-foundation/ui-settings').fromShareHash>;
  restoreBeforeLink(): void;
  importText(text: string): boolean;
  exportText(): string;
  open(trigger?: Element): void;
  close(): void;
  destroy(): void;
};
