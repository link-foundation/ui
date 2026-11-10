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
  sectionLevels?: Record<string, string>;
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
export type SettingsMessageKey =
  | 'back'
  | 'inherit'
  | 'inherited'
  | 'levels'
  | 'levelOwned'
  | 'copyLooks'
  | 'emptyLooks'
  | 'defaultLook'
  | 'updateLook'
  | 'renameLook'
  | 'looksError'
  | 'settings'
  | 'close'
  | 'search'
  | 'preset'
  | 'custom'
  | 'randomize'
  | 'resetAll'
  | 'confirmReset'
  | 'peek'
  | 'changes'
  | 'copyText'
  | 'copied'
  | 'copyFallback'
  | 'copyChanges'
  | 'pasteChanges'
  | 'invalid'
  | 'applied'
  | 'import'
  | 'readError'
  | 'export'
  | 'share'
  | 'shareError'
  | 'lookName'
  | 'looks'
  | 'saveLook'
  | 'applyLook'
  | 'deleteLook'
  | 'beforeLink'
  | 'reset'
  | 'tabs'
  | 'value'
  | 'changed'
  | 'count'
  | 'rejected'
  | 'increment'
  | 'decrement'
  | 'palette'
  | 'rgb'
  | 'red'
  | 'green'
  | 'blue'
  | 'number'
  | 'remove'
  | 'add';
export interface SettingsMessageParams {
  label?: string;
  count?: number;
  keys?: string[];
}
export type SettingsMessages = Partial<
  Record<
    SettingsMessageKey,
    string | ((params: SettingsMessageParams) => string)
  >
>;
export interface SettingsPanelOptions extends PanelModelOptions {
  document?: Document;
  values?: SettingsValues;
  target?: SettingsTarget;
  mode?: 'page' | 'drawer';
  label?: string;
  messages?: SettingsMessages;
  previewRoot?: HTMLElement;
  project?: SettingsProjection;
  onPreview?: (values: SettingsValues, root: HTMLElement) => void;
  columns?: number | { count: number; balance: 'estimate' };
  presets?: { display: 'cards' };
  peek?: 'hold' | 'toggle';
  looksStorage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  looksStorageKey?: string;
  onChangedCount?: (count: number) => void;
  mountMiniature?: (context: {
    container: HTMLElement;
    values: SettingsValues;
    preset?: import('@link-foundation/ui-settings').SettingsPreset;
    look?: string;
  }) => { update?(values: SettingsValues): void; destroy?(): void };
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
    field?: SettingField;
    section?: SettingsSection;
    level?: string;
    values: SettingsValues;
  }) => {
    update(
      values: SettingsValues,
      definition: SettingField | SettingsSection,
      level?: string
    ): void;
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
  setSectionLevel(section: string, level: string): void;
  changedCount(): number;
  setLevel(level?: string): void;
  setMessages(messages: SettingsMessages): void;
  saveLook(name?: string): boolean;
  renameLook(name: string, nextName: string): boolean;
  deleteLook(name: string): boolean;
  exportLooks(): string;
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
