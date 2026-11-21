import type { Vocabulary } from '@link-foundation/ui-core';

export interface EmbedPost {
  id: string;
  hash: string;
}
export interface EmbedLabels {
  title: string;
  archive: string;
  showEmbed: string;
  showArchive: string;
}
export interface EmbedWidgetOptions {
  x?: Readonly<Record<string, unknown>> & {
    width?: number;
    align?: 'left' | 'center' | 'right';
  };
  vk?: Readonly<Record<string, unknown>> & { width?: number | string };
  telegram?: {
    checkAvailability?(
      post: Pick<EmbedContext, 'id' | 'url' | 'locale' | 'theme' | 'signal'>
    ): boolean | Promise<boolean>;
  };
}
export interface EmbedContext extends EmbedPost {
  theme: 'light' | 'dark';
  locale: string;
  labels: EmbedLabels;
  url: string;
  window: Window;
  signal: AbortSignal;
  scriptTimeout?: number;
  widgetOptions?: EmbedWidgetOptions;
  ready(): void;
  unavailable(): void;
}
export interface EmbedProvider {
  script: string | null;
  /** Require an explicit ready() signal even when an iframe has a height. */
  readiness?: 'provider';
  validate(post: EmbedPost): boolean;
  url(
    post: EmbedPost,
    context: { theme: 'light' | 'dark'; locale: string }
  ): string;
  render(
    container: HTMLElement,
    context: EmbedContext
  ): void | (() => void) | Promise<void | (() => void)>;
}
export interface EmbedOptions {
  provider?: string;
  id?: string;
  hash?: string;
  theme?: 'light' | 'dark' | 'system';
  locale?: string;
  timeout?: number;
  scriptTimeout?: number;
  rootMargin?: string;
  enabled?: boolean;
  toggle?: boolean;
  debug?: boolean;
  labels?: Partial<EmbedLabels>;
  /** Mount-time option. Show this element in place on fallback or when off. */
  archive?: HTMLElement;
  widgetOptions?: EmbedWidgetOptions;
  log?: (...args: unknown[]) => void;
}
export interface EmbedController {
  update(options: Partial<Omit<EmbedOptions, 'archive'>>): void;
  retry(): void;
  destroy(): void;
}
export function registerEmbedProvider(
  name: string,
  provider: EmbedProvider
): () => void;
export function getEmbedProvider(
  name: string
): Readonly<EmbedProvider> | undefined;
export function loadEmbedScript(
  document: Document,
  url: string,
  options?: { timeout?: number }
): Promise<void>;
export function createEmbed(
  host: HTMLElement,
  options?: EmbedOptions
): EmbedController;
export function defineEmbedElement(
  win?: Window
): CustomElementConstructor | undefined;
export function embedVocabulary(base?: Vocabulary): Vocabulary;
export const EMBED_KIND_TEXT: string;
