/// <reference lib="dom" />

import type {
  App,
  Component,
  DefineComponent,
  InjectionKey,
  MaybeRefOrGetter,
  ShallowRef,
} from 'vue';
import type { ParseOptions, RawValue } from '@link-foundation/ui-core';
import type {
  ActionDetail,
  Diagnostic,
  KindSpec,
  Kinds,
  RenderOptions,
} from '@link-foundation/ui-dom';
import type {
  ElementView,
  Store,
  StoreOptions,
} from '@link-foundation/ui-store';

/** A handler of an action: the `ui-action` detail and the DOM event. */
export type ActionHandler = (detail: ActionDetail, event: Event) => void;

/** Action handlers by name (`save`, `navigate`). */
export type ActionHandlers =
  | Record<string, ActionHandler>
  | Map<string, ActionHandler>;

/** Handlers by name, falling back to a parent registry. */
export interface ActionRegistry {
  /** Add a handler; returns a function that removes it. */
  register(name: string, handler: ActionHandler): () => boolean;
  /** The handlers of a name: the own ones, else the parent's. */
  handlers(name: string): ActionHandler[];
}

export function createActionRegistry(
  initial?: ActionHandlers,
  parent?: ActionRegistry | null
): ActionRegistry;

export interface UiPluginOptions {
  /** The store of every `UiView` without `source`/`store` and of the composables. */
  store?: Store;
  /** App-wide action handlers. */
  actions?: ActionHandlers;
}

export interface UiPlugin {
  install(app: App): void;
  /** The action registry the plugin provides. */
  readonly registry: ActionRegistry;
}

/** Provide a store and an action registry to the whole app. */
export function createUiPlugin(options?: UiPluginOptions): UiPlugin;

/** The injection key of the store (or a ref of it). */
export const UI_STORE_KEY: InjectionKey<MaybeRefOrGetter<Store | null>>;
/** The injection key of the action registry. */
export const UI_ACTIONS_KEY: InjectionKey<ActionRegistry>;

/** A store, a ref of one or a getter. */
export type StoreSource = MaybeRefOrGetter<Store | null | undefined>;

/**
 * A reactive slice of the store, assigned only when the selected value
 * changes (`Object.is`). The listener is removed with the effect scope.
 */
export function useUiStore<T>(
  selector: (store: Store) => T,
  store?: StoreSource
): Readonly<ShallowRef<T>>;

/** The store view of an element; `undefined` while it does not exist. */
export function useUiElement(
  id: MaybeRefOrGetter<string>,
  store?: StoreSource
): Readonly<ShallowRef<ElementView | undefined>>;

/**
 * The values of a property of an element (positional values under their
 * vocabulary names, overridden by a named property; the `unknown`
 * sub-links of a kind the vocabulary does not know).
 */
export function useUiProp(
  id: MaybeRefOrGetter<string>,
  name: MaybeRefOrGetter<string>,
  store?: StoreSource
): Readonly<ShallowRef<readonly RawValue[] | undefined>>;

/** Handle an action by name for the lifetime of the current effect scope. */
export function useUiAction(
  name: string,
  handler: ActionHandler
): () => boolean;

/** The values of a property of a store view (see `useUiProp`). */
export function propOf(
  view: ElementView | undefined,
  name: string
): readonly RawValue[] | undefined;

/** The handler names of an action: `(emit save)` → `['save', 'emit']`. */
export function actionNames(action: readonly RawValue[]): string[];

export interface UiViewProps {
  /** Links Notation text; a new store is created when it changes. */
  source?: string;
  /** A ui-store store (before `source` and the injected store). */
  store?: Store;
  /** Action handlers by name, before the registered ones. */
  actions?: ActionHandlers;
  /** Vue components of custom kinds, by kind; they receive `{ id }`. */
  components?: Record<string, Component>;
  /** Inline the static HTML of the document on the server. */
  ssr?: boolean;
  /** Other ui-dom render options, and the options of the `source` store. */
  options?: RenderOptions & {
    parseOptions?: ParseOptions;
    storeOptions?: StoreOptions;
  };
}

export type UiViewEmits = {
  action: (detail: ActionDetail, event: Event) => void;
};

/** Renders a ui-store document with ui-dom. */
export const UiView: DefineComponent<
  UiViewProps,
  {},
  {},
  {},
  {},
  {},
  {},
  UiViewEmits
>;

/** Whether a tag is a ui-dom custom element (`ui-*`). */
export function isUiCustomElement(tag: string): boolean;

/** The tag custom kind components render into. */
export const UI_VUE_HOST_TAG: 'ui-vue-host';

/** ui-dom kind specs rendering each kind of `components` as a host element. */
export function hostKinds(
  components: Record<string, unknown> | null | undefined,
  hooks?: {
    created?(host: HTMLElement, el: object): void;
    destroyed?(host: HTMLElement): void;
  }
): Record<string, KindSpec>;

/** A store of Links Notation text (like ui-dom `mountDocument`). */
export function storeFromSource(
  text: string,
  options?: {
    onDiagnostic?: (diagnostic: Diagnostic) => void;
    parseOptions?: ParseOptions;
    storeOptions?: StoreOptions;
  }
): Store;

/** The static HTML of a store, with empty hosts for `components`. */
export function renderStaticHTML(
  store: Store,
  options?: {
    kinds?: Kinds;
    onDiagnostic?: (diagnostic: Diagnostic) => void;
    prefix?: string;
  },
  components?: Record<string, unknown>
): string;
