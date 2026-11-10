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
export interface EmbedContext extends EmbedPost {
  theme: 'light' | 'dark';
  locale: string;
  labels: EmbedLabels;
  url: string;
  window: Window;
  signal: AbortSignal;
  ready(): void;
  unavailable(): void;
}
export interface EmbedProvider {
  script: string | null;
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
  log?: (...args: unknown[]) => void;
}
export interface EmbedController {
  update(options: Partial<EmbedOptions>): void;
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
