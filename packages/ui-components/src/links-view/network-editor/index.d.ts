import type {
  NetworkPresentation,
  NetworkPresentationSnapshot,
  NetworkPresentationProvider,
} from '../index.js';
import type { Configuration } from '../configurations.js';

export interface NetworkEditorValues {
  [key: string]: unknown;
  turns: [number, number][];
  linkGaps: [number | null, number | null, number | null, number | null][];
  linkColors: (string | null)[];
  frame: [number, number, number] | null;
  order: number[] | null;
}
export interface NetworkOptionDefinition {
  readonly key: string;
  readonly type: string;
  readonly default: string | number | boolean;
  readonly section: string;
  readonly availability: string;
  readonly min?: number | string;
  readonly max?: number | string;
  readonly step?: number;
  readonly choices?: readonly string[];
}
export interface NetworkEditorSnapshot {
  links: Configuration;
  options: NetworkEditorValues;
  code: string;
}
export interface NetworkSolverResult {
  turns: NetworkEditorValues['turns'];
  linkGaps: NetworkEditorValues['linkGaps'];
  frame: NetworkEditorValues['frame'];
  before: number;
  after: number;
  delta?: unknown;
}
export interface NetworkEditorSettings {
  presentation: NetworkPresentation;
  configurations?: typeof import('../configurations.js');
  solve?: (
    links: Configuration,
    options: NetworkEditorValues,
    context: { signal: AbortSignal }
  ) => Promise<NetworkSolverResult>;
  locale?: 'en' | 'ru';
  serializeOptions?: (options: NetworkEditorValues) => string;
  readOptions?: (text: string) => Partial<NetworkEditorValues>;
  syncUrl?: boolean;
  debug?: (message: string, data?: object) => void;
}
export interface NetworkEditor {
  readonly ready: Promise<unknown>;
  snapshot(): NetworkEditorSnapshot;
  updateOptions(patch: Partial<NetworkEditorValues>): Promise<boolean>;
  updateLinks(links: Configuration): Promise<boolean>;
  restoreUrl(): Promise<unknown>;
  dispose(): void;
}
export function createNetworkEditor(
  root: HTMLElement,
  settings: NetworkEditorSettings
): NetworkEditor;
export const networkOptionSchema: readonly NetworkOptionDefinition[];
export const networkOverrideSchema: readonly NetworkOptionDefinition[];
export function normalizeNetworkOptions(
  input?: Record<string, unknown>
): NetworkEditorValues;
export function networkOptionsToParams(
  options: Record<string, unknown>
): URLSearchParams;
export function networkOptionsFromParams(
  params: string | URLSearchParams
): NetworkEditorValues;
export function networkOptionsToLino(options: Record<string, unknown>): string;
export function networkOptionsFromLino(text?: string): NetworkEditorValues;
export function networkOptionAvailable(
  field: NetworkOptionDefinition,
  links: Configuration,
  options: NetworkEditorValues
): boolean;
export const networkLooks: Readonly<
  Record<string, Readonly<Record<string, unknown>>>
>;
export const networkSizePresets: readonly (readonly [number, number])[];
export function networkFilename(code: string, extension: string): string;
export function networkShareTargets(
  url: string,
  title?: string
): Record<string, string>;
export interface NetworkUrlSyncSettings {
  window?: Window;
  root?: EventTarget;
  urlFor(
    snapshot: NetworkPresentationSnapshot,
    currentHref: string
  ): string | URL;
  delay?: number;
  setTimer?: (fn: () => void, delay: number) => unknown;
  clearTimer?: (id: unknown) => void;
  debug?: (message: string, data?: object) => void;
}
export function syncNetworkUrl(
  presentation: NetworkPresentation,
  settings: NetworkUrlSyncSettings
): { flush(): void; dispose(): void };

export function createNetworkEditorProvider(configuration?: {
  debug?: (message: string, data?: object) => void;
}): NetworkPresentationProvider;
