/**
 * Types of `@link-foundation/ui-react`: `<UiView>`, the provider, the
 * hooks and the React components of custom kinds.
 */

import type { ComponentType, CSSProperties, ReactNode, RefObject } from 'react';
import type { Store } from '@link-foundation/ui-store';
import type { ParseOptions } from '@link-foundation/ui-core';
import type {
  Diagnostic,
  KindSpec,
  Kinds,
  RenderHandle,
  StyleOptions,
} from '@link-foundation/ui-dom';
import type { ActionDetail, Actions, UiProps } from './hooks.js';

export * from './hooks.js';

/** The props a React component of a custom kind receives. */
export interface UiComponentProps {
  /** The store ID of the element. */
  id: string;
  /** Its properties by name; updated from the store. */
  props: UiProps;
  /** The ui-dom nodes of its children. */
  children: ReactNode;
}

export interface UiViewProps extends StyleOptions {
  /** Links Notation text, parsed once per distinct string. */
  source?: string;
  /** A ui-store store (wins over `source` and the provider). */
  store?: Store;
  parseOptions?: ParseOptions;
  /** Host functions by action name (or an actions registry). */
  actions?: Actions;
  /** Called for every action of the view before its handler. */
  onAction?(detail: ActionDetail, event: Event): void;
  onDiagnostic?(diagnostic: Diagnostic): void;
  onPatch?(events: readonly object[]): void;
  /** React components of custom kinds: `{ chart: MyChart }`. */
  components?: Record<string, ComponentType<UiComponentProps>>;
  /** Extra ui-dom kind renderers of this view. */
  kinds?: Kinds;
  /** Set `document.title` from the document's `title`. */
  setTitle?: boolean;
  /** `false` applies no stylesheet. */
  adoptStyles?: boolean;
  /** Inline the static HTML of the document (replaced on mount). */
  ssr?: boolean;
  /** Receives the ui-dom render handle while mounted. */
  handleRef?: RefObject<RenderHandle | null>;
  className?: string;
  style?: CSSProperties;
  id?: string;
}

/** Mount the ui-dom renderer into a `<div data-ui-root>`. */
export function UiView(props: UiViewProps): ReactNode;

/** The tag of the node a React component renders into. */
export const HOST_TAG: 'ui-react-host';
/** The tag of the node the children of a host are rendered in. */
export const SLOT_TAG: 'ui-react-slot';

export interface HostEntry {
  key: string;
  host: HTMLElement;
  slot: HTMLElement;
  kind: string;
  id: string;
}

export interface HostRegistry {
  subscribe(listener: () => void): () => void;
  snapshot(): readonly HostEntry[];
  add(entry: Omit<HostEntry, 'key'>): void;
  remove(host: HTMLElement): void;
  rename(before: string, id: string): void;
  clear(): void;
  listenerCount(): number;
}

export function createHostRegistry(): HostRegistry;

/** The ui-dom kind spec of a React-rendered kind. */
export function hostKind(kind: string, hosts: HostRegistry | null): KindSpec;

/** Static HTML of a store, React kinds as empty host elements. */
export function renderViewToHTML(
  store: Store,
  options?: {
    kinds?: Kinds;
    componentKinds?: readonly string[];
    prefix?: string;
    onDiagnostic?(diagnostic: Diagnostic): void;
  }
): string;

/** A store of Links Notation text with the parse diagnostics. */
export function storeOfSource(
  source: string,
  parseOptions?: ParseOptions
): { store: Store; diagnostics: Diagnostic[] };
