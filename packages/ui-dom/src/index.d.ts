import type {
  Diagnostic as CoreDiagnostic,
  ParseOptions,
  RawValue,
  UiDocument,
  UiNode,
  UiProperty,
} from '@link-foundation/ui-core';
import type { Store, StoreOptions } from '@link-foundation/ui-store';
import type { ResolvedTokens } from '@link-foundation/ui-tokens';

/** A diagnostic of the renderer (`unknown-kind`, `missing-alt`, …). */
export interface DomDiagnostic {
  code:
    | 'unknown-kind'
    | 'kind-error'
    | 'missing-alt'
    | 'unsafe-url'
    | 'invalid-handler'
    | 'unknown-action'
    | 'unknown-event'
    | 'invalid-value'
    | 'bad-event'
    | (string & {});
  severity: 'error' | 'warning' | 'info';
  message: string;
  at: Record<string, unknown>;
}

/** A diagnostic of the renderer, the parser, the tokens or the styles. */
export type Diagnostic = DomDiagnostic | CoreDiagnostic;

/** The element model a kind renderer sees. */
export interface UiElement {
  /** The store ID (`data-link-id`). */
  readonly id: string;
  /** The id in the document; `null` for an anonymous element. */
  readonly name: string | null;
  readonly kind: string | null;
  readonly positional: readonly RawValue[];
  readonly properties: readonly UiProperty[];
  readonly unknown: readonly RawValue[];
  /**
   * Every property by name: the positional values under their vocabulary
   * names (`text` → `value`, `button` → `label`, `image` → `source`),
   * overridden by the named properties.
   */
  readonly props: ReadonlyMap<string, readonly RawValue[]>;
}

export interface KindContext {
  /** The document nodes are created in. */
  document: Document;
  /** The render options. */
  options: RenderOptions;
  /** Report a problem of the current element. */
  diagnostic(
    code: string,
    severity: 'error' | 'warning' | 'info',
    at?: Record<string, unknown>
  ): void;
}

/** The DOM renderer of one element kind. */
export interface KindSpec {
  /** A valid custom element name (`ui-button`). */
  tag: string;
  /** Build the node; the renderer then calls `update` with every property. */
  create(el: UiElement, ctx: KindContext): HTMLElement;
  /** Apply the changed properties. */
  update?(
    node: HTMLElement,
    el: UiElement,
    changed: string[],
    ctx: KindContext
  ): void;
  /** Where the children go (default: the node itself; `null`: none). */
  childrenSlot?: null | ((node: HTMLElement) => HTMLElement);
  /** The element the `(on EVENT ...)` listeners go on (default: the node). */
  eventTarget?(node: HTMLElement): HTMLElement;
  /**
   * Properties mirrored as attributes for CSS; `on*` names are refused.
   * A boolean attribute is present for `true` and absent otherwise.
   */
  attributes?: Record<string, 'string' | 'boolean'>;
  destroy?(node: HTMLElement, ctx: KindContext): void;
}

/** The detail of a `ui-action` event. */
export interface ActionDetail {
  /** The store ID of the element whose handler fired. */
  readonly source: string | null;
  /** The document event (`press`, `focus`, `blur`, `hover`). */
  readonly event: string;
  /** The action and its arguments: `['navigate', 'home']`. */
  readonly action: readonly RawValue[];
}

export type Kinds = Map<string, KindSpec> | Record<string, KindSpec>;

export interface StyleOptions {
  /** ui-tokens LiNo text, `{ sets }` of `readTokens`, or resolved tokens. */
  tokens?: string | { sets: Map<string, unknown> } | ResolvedTokens;
  /** The token set (default: the document's `theme`, else the first set). */
  theme?: string;
  /** ui-style LiNo text, or the rules of `readStyles`. */
  styles?: string | readonly object[];
  /** Extra CSS appended to the sheet. */
  css?: string;
  /** The CSS custom property prefix (`md` → `--md-color-primary`). */
  prefix?: string;
  /** `false` leaves out the base rules. */
  baseCss?: boolean;
}

export interface RenderOptions extends StyleOptions {
  /** Kind renderers of this render, looked up before the registry. */
  kinds?: Kinds;
  /** Called for every `ui-action`, after the event is dispatched. */
  onAction?(detail: ActionDetail, event: Event): void;
  onDiagnostic?(diagnostic: Diagnostic): void;
  /** Called once per applied patch with its store events. */
  onPatch?(events: readonly object[]): void;
  /** Set `document.title` from the document's `title`. */
  setTitle?: boolean;
  /** `false` applies no stylesheet. */
  adoptStyles?: boolean;
}

export interface RenderHandle {
  readonly store: Store;
  /** The diagnostics of the first render. */
  readonly diagnostics: readonly Diagnostic[];
  readonly styles: {
    sheet?: CSSStyleSheet;
    element?: HTMLStyleElement;
    release(): void;
  } | null;
  /** The node of a store ID; `null` when it has none. */
  nodeFor(id: string): HTMLElement | null;
  /** The store ID of a node or of its closest rendered ancestor. */
  idFor(node: Node): string | null;
  /** Apply the pending store events now; returns how many there were. */
  flush(): number;
  /** Remove every node, the store listener and the stylesheet. */
  destroy(): void;
}

/** Render a ui-store document as custom elements and keep it in sync. */
export function render(
  container: globalThis.Element | ParentNode,
  store: Store,
  options?: RenderOptions
): RenderHandle;

/** Parse Links Notation, create a store and render it. */
export function mountDocument(
  container: globalThis.Element | ParentNode,
  text: string,
  options?: RenderOptions & {
    parseOptions?: ParseOptions;
    storeOptions?: Omit<StoreOptions, 'document'>;
  }
): {
  store: Store;
  handle: RenderHandle;
  diagnostics: Diagnostic[];
};

export interface HtmlOptions {
  kinds?: Kinds;
  onDiagnostic?(diagnostic: Diagnostic): void;
  prefix?: string;
}

/** Static HTML of a document: escaped, without `on*` attributes or scripts. */
export function renderToHTML(
  source: string | Store | UiDocument | UiNode | UiNode[],
  options?: HtmlOptions
): string;

/** Escape `& < > " '` for HTML text and attribute values. */
export function escapeHtml(text: string): string;

/** Register the DOM renderer of a kind (replacing an earlier one). */
export function defineKind(kind: string, spec: KindSpec): Readonly<KindSpec>;
/** The renderer of a kind: the overrides first, then the registry. */
export function getKind(
  kind: string | null,
  overrides?: Kinds
): Readonly<KindSpec> | undefined;
export function registeredKinds(): string[];
export function isCustomElementName(tag: string): boolean;
/** The `ui-unknown` fallback of a kind without a renderer. */
export const UNKNOWN_KIND: Readonly<KindSpec>;

/** The DOM event of each document event. */
export const DOM_EVENTS: Readonly<{
  press: 'click';
  focus: 'focusin';
  blur: 'focusout';
  hover: 'pointerenter';
}>;

/** The base rules: layout of the basic kinds, focus ring, disabled state. */
export const BASE_CSS: string;
/** The CSS text of a render: base rules, tokens, style rules, `css`. */
export function buildCss(
  options?: StyleOptions,
  theme?: string,
  report?: (diagnostic: Diagnostic) => void
): string;

/** Whether a URL uses a `javascript:`, `data:` or `vbscript:` scheme. */
export function isUnsafeUrl(url: string): boolean;
