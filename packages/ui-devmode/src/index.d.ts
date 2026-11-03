/**
 * Type declarations of `@link-foundation/ui-devmode` (see README.md).
 */

/** The entry points that may open dev mode. */
export type EntryPoint = 'shortcut' | 'url-parameter' | 'element';
/** The layers dev mode may write. */
export type WritableLayer = 'user' | 'session';

export interface PolicyWarning {
  /** `unknown-key`, `unknown-entry`, `unknown-layer`, `read-only-layer`,
   * `bad-value` or `duplicate-policy`. */
  code: string;
  severity: 'warning';
  message: string;
  at: Record<string, unknown>;
}

export interface DevModePolicy {
  enabled: boolean;
  entry: ReadonlySet<EntryPoint>;
  /** The key combination, `Alt+Shift+D` by default. */
  shortcut: string;
  /** The layers dev mode writes, lowest first. */
  writeLayers: readonly WritableLayer[];
  /** Ids of read-only elements (their descendants are read-only too). */
  lockedElements: ReadonlySet<string>;
  repository?: string;
  siteConfig?: string;
  comfortKeys: ReadonlySet<string>;
  warnings: readonly PolicyWarning[];
}

export const POLICY_KIND: 'dev-mode';
export const ENTRY_POINTS: readonly EntryPoint[];
export const WRITABLE_LAYERS: readonly WritableLayer[];
export const DEFAULT_SHORTCUT: 'Alt+Shift+D';
export function defaultPolicy(): DevModePolicy;
/** Read a `(name: dev-mode …)` policy from Links Notation text, a ui-core
 * document or nodes. */
export function parseDevModePolicy(links: string | object): DevModePolicy;

export interface Shortcut {
  altKey: boolean;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  /** A `KeyboardEvent.code`, such as `KeyD`. */
  code: string;
}

export const URL_PARAMETER: 'ui-dev';
export const ELEMENT_NAME: 'ui-dev-mode';
export const REQUEST_EVENT: 'ui-dev-mode-request';
export function parseShortcut(text: string): Shortcut;
export function matchesShortcut(
  event: Pick<
    KeyboardEvent,
    'code' | 'altKey' | 'shiftKey' | 'ctrlKey' | 'metaKey'
  >,
  shortcut: Shortcut
): boolean;
export function isEditableTarget(node: unknown): boolean;
export function shouldActivate(input: {
  url: string | URL;
  policy: DevModePolicy;
  hasElement?: boolean;
}): boolean;
export function installActivation(options: {
  window: Window & typeof globalThis;
  policy: DevModePolicy;
  onActivate: (entry: EntryPoint) => void;
  onToggle?: (entry: EntryPoint) => void;
}): () => void;

export const MESSAGES: Readonly<Record<string, string>>;
export function message(
  table: Readonly<Record<string, string>>,
  key: string,
  params?: Record<string, string | number>
): string;
export function translator(
  table?: Readonly<Record<string, string>>
): (key: string, params?: Record<string, string | number>) => string;

/** The name of the global handle of an open dev mode. */
export const GLOBAL_NAME: 'linkUiDevMode';

/** `globalThis.linkUiDevMode`, present only while dev mode is open. */
export interface DevModeHandle {
  select(id: string | null): string | null;
  getSelection(): { id: string; type: string } | null;
  setProperty(
    id: string,
    name: string,
    value: unknown
  ): {
    id: string;
    name: string;
    key: string | null;
    layer: WritableLayer;
    values: readonly unknown[];
  };
  close(): void;
}

declare global {
  // eslint-disable-next-line no-var
  var linkUiDevMode: DevModeHandle | undefined;
}

export interface MountDevModeOptions {
  /** The container ui-dom rendered into. */
  root: Element;
  /** The ui-config configuration of the page, bound to its store. */
  config: object;
  /** A policy object, Links Notation text, a ui-core document or nodes. */
  policy?: string | object | DevModePolicy;
  /** The store `mountDocument` returned. */
  store?: object;
  /** The handle `mountDocument` returned. */
  handle?: { nodeFor?: (id: string) => Element | null };
  styles?: string | object[];
  tokens?: string | Map<string, object>;
  theme?: string;
  animations?: string | object[];
  vocabulary?: object;
  messages?: Record<string, string>;
  /** The inspector layout (Links Notation); `inspector.lino` by default. */
  layout?: string;
  window?: Window & typeof globalThis;
  onOpen?: () => void;
  onClose?: () => void;
}

export interface DevModeController {
  readonly policy: DevModePolicy;
  readonly isOpen: boolean;
  /** Open dev mode (loads the inspector the first time). */
  open(): Promise<boolean>;
  close(): void;
  toggle(): Promise<boolean>;
  select(id: string | null): Promise<string | null>;
  /** Close dev mode and remove its entry points. */
  destroy(): void;
}

export function mountDevMode(options: MountDevModeOptions): DevModeController;

export interface OverrideExport {
  text: string;
  links: import('@link-foundation/ui-core').RawValue[];
  count: number;
}
export function exportOverrides(
  config: import('@link-foundation/ui-config').Config,
  options?: {
    id?: string;
    base?: string;
    layers?: WritableLayer[];
  }
): OverrideExport;
export const URL_BUDGET: 8192;
export const BACKUP_KEY: 'ui-overrides:before-the-link';
export function encodeShareHash(text: string): string;
export function decodeShareHash(hash: string): string | null;
export function shareUrl(
  location: string | URL | Pick<Location, 'href'>,
  text: string
): { url: string; tooLong: boolean };
export interface ValidationSchema {
  document: import('@link-foundation/ui-core').UiDocument;
  vocabulary?: import('@link-foundation/ui-core').Vocabulary;
}
export interface ValidationReport {
  links: import('@link-foundation/ui-core').RawValue[];
  rejected: { link: unknown; reason: string }[];
}
export function validateOverrides(
  text: string,
  options: {
    schema: ValidationSchema | import('@link-foundation/ui-core').UiDocument;
    policy?: DevModePolicy;
  }
): ValidationReport;
export function applySharedOverrides(options: {
  config: import('@link-foundation/ui-config').Config;
  location?: Location;
  history?: History;
  storage: Pick<Storage, 'setItem'>;
  schema?: ValidationSchema | import('@link-foundation/ui-core').UiDocument;
  policy?: DevModePolicy;
  text?: string;
  document?: Document;
  t?: ReturnType<typeof translator>;
}):
  | (ValidationReport & { applied: boolean; keep(): void; discard(): void })
  | null;
