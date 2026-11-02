/**
 * Type declarations of `@link-foundation/ui-i18n` (see README.md).
 */

import type {
  Diagnostic,
  PropertySpec,
  RawValue,
  UiDocument,
  UiNode,
  Vocabulary,
  values,
} from '@link-foundation/ui-core';
import type { Config } from '@link-foundation/ui-config';

/** Messages of every locale: `{ en: { 'ui.dialog.close': 'Close' } }`. */
export type Catalogs = Record<string, Record<string, string>>;

/** A message param: text, a number or another message. */
export type MessageParam = string | number | Message;

/** The typed form of `(t KEY (PARAM VALUE) ...)`. */
export interface Message {
  type: 'message';
  key: string;
  params: Record<string, MessageParam>;
}

/** The head of a message link: `t`. */
export const MESSAGE_HEAD: 't';
export function isMessage(value: unknown): value is Message;
/** Whether a raw value is a `(t ...)` link (well-formed or not). */
export function isMessageLink(raw: unknown): raw is RawValue[];
/**
 * Read `(t KEY (PARAM VALUE) ...)`: `undefined` when `raw` is not a message
 * link, `null` when it is malformed.
 */
export function parseMessage(raw: RawValue): Message | null | undefined;
export function message(
  key: string,
  params?: Record<string, MessageParam>
): Message;
/** The raw form of a message, as ui-core `format` writes it. */
export function messageRaw(value: Message): RawValue[];

export interface MessageDiagnostic extends values.ValueDiagnostic {
  expected?: 'message' | string;
}
/** ui-core `values.typeValue` with the `message` type. */
export function typeValue(
  raw: RawValue,
  spec?: values.ValueSpec,
  options?: values.TypeOptions
): {
  value: values.TypedValue | Message | null;
  diagnostics: MessageDiagnostic[];
};

/** Merge catalogs per locale; later catalogs win. */
export function mergeCatalogs(...catalogs: Catalogs[]): Catalogs;
/** Read a `.lino` catalog (lino-i18n `parseLinoCatalogs`). */
export function readCatalogs(text: string): Catalogs;
/** Load every catalog of a directory (Node.js, Bun, Deno). */
export function loadCatalogDir(
  dir: string,
  options?: { recursive?: boolean }
): Promise<Catalogs>;
/** The framework catalog: `locales/ui.lino`. */
export const UI_CATALOG_URL: URL;
export const UI_LOCALES_URL: URL;
/** Load `locales/ui.lino` from the file system or with `fetch`. */
export function loadUiCatalogs(options?: {
  fetch?: typeof fetch;
}): Promise<Catalogs>;

/** The root prop that holds the locale: `locale`. */
export const LOCALE_PROP: 'locale';
export type Direction = 'ltr' | 'rtl';
/** lino-i18n `getLocaleDirection`; `ltr` for an invalid tag. */
export function localeDirection(locale: string): Direction;

export type LocaleListener = (locale: string, previous: string | null) => void;

export interface LocalizerOptions {
  /** The ui-config whose layers hold the root prop `locale`. */
  config?: Config;
  catalogs: Catalogs;
  /** Default: the locales of `catalogs`. */
  approved?: readonly string[];
  /** Default: `en`. */
  defaultLocale?: string;
  /** The element that holds `locale`; default `config.base`. */
  root?: string | null;
  /** The locale when no config layer sets one. */
  locale?: string;
  /** The platform languages; default `navigator.languages`. */
  languages?: readonly string[];
  /** The layer `setLocale` writes; default `user`. */
  layer?: 'user' | 'session';
  /** A key missing in every locale. */
  onMissing?: (key: string, locale: string) => void;
  onListenerError?: (error: unknown) => void;
}

export interface Localizer {
  /** The approved locale in use. */
  locale(): string;
  direction(): Direction;
  approved(): string[];
  /**
   * The text of a value: strings unchanged, messages and raw `(t ...)` links
   * from the catalogs; a missing key gives the key.
   */
  text(value: unknown, params?: Record<string, unknown>): string;
  has(key: string, locale?: string): boolean;
  localizeDocument(doc: UiDocument): UiDocument;
  /** Set (or with `null` remove) the locale override. */
  setLocale(next: string | null): void;
  subscribe(listener: LocaleListener): () => boolean;
}

export function createLocalizer(options: LocalizerOptions): Localizer;
export function resolveText(
  value: unknown,
  localizer: Pick<Localizer, 'text'>,
  params?: Record<string, unknown>
): string;

/**
 * A copy of a document with every message replaced by its text and the
 * root marked with `(lang ...)` and `(dir ...)`.
 */
export function localizeDocument(
  doc: UiDocument,
  localizer: Pick<Localizer, 'text' | 'locale' | 'direction'>,
  options?: { root?: string | null }
): UiDocument;

/** Props added to the `document` kind: `locale`, `dir`, `i18n`. */
export const ROOT_PROPS: Readonly<Record<string, PropertySpec>>;
/** `base` (default ui-dialect/0) with `t` on every kind and `ROOT_PROPS`. */
export function i18nVocabulary(base?: Vocabulary): Vocabulary;

export const DEFAULT_TEXT_PROPS: readonly string[];
export const DEFAULT_TEXT_KINDS: Readonly<Record<string, boolean>>;
export const HARDCODED_TEXT: 'hardcoded-text';
export function requiresI18n(root: UiNode): boolean;

export interface HardcodedTextDiagnostic extends Diagnostic {
  value?: string;
}
export function checkHardcodedText(
  docText: string,
  options?: {
    textProps?: readonly string[];
    kinds?: Record<string, boolean>;
    vocabulary?: Vocabulary;
  }
): HardcodedTextDiagnostic[];

export function propValues(node: UiNode, name: string): RawValue[] | undefined;
export function propAtom(node: UiNode, name: string): string | undefined;
