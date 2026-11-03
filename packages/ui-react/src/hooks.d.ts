/**
 * Types of `@link-foundation/ui-react/hooks`: DOM-free React hooks over a
 * ui-store store (no `react-dom`, no `ui-dom`).
 */

import type { Context, ReactNode } from 'react';
import type { ElementView, Store } from '@link-foundation/ui-store';
import type { RawValue } from '@link-foundation/ui-core';

/** The detail of a ui-dom `ui-action` event. */
export interface ActionDetail {
  /** The store ID of the element whose handler fired. */
  readonly source: string | null;
  /** The document event (`press`, `focus`, `blur`, `hover`). */
  readonly event: string;
  /** The action and its arguments: `['emit', 'save']`. */
  readonly action: readonly RawValue[];
}

export type ActionHandler = (detail: ActionDetail, event?: Event) => unknown;

/** An actions registry: `has(name)` and `dispatch(name, args, meta)`. */
export interface ActionRegistryLike {
  has(name: string): boolean;
  dispatch(
    name: string,
    args: readonly RawValue[],
    meta: { detail: ActionDetail; event?: Event }
  ): unknown;
}

/**
 * Host functions by action name: `(emit save)` calls `save`, then `emit`;
 * any other action calls its head (`navigate`, `set`, …).
 */
export type Actions = Record<string, ActionHandler> | ActionRegistryLike;

export interface ActionRegistry {
  parent: ActionRegistry | null;
  setActions(actions: Actions | null | undefined): void;
  /** Register a handler; returns a function that removes it. */
  register(name: string, handler: ActionHandler): () => void;
  configured(): boolean;
  lookup(action: readonly RawValue[]): ActionHandler | undefined;
  /** Call the handler of an action; returns whether one ran. */
  dispatch(detail: ActionDetail, event?: Event): boolean;
}

export function createActionRegistry(
  parent?: ActionRegistry | null
): ActionRegistry;

export interface UiContextValue {
  store: Store | null;
  registry: ActionRegistry | null;
}

export const UiContext: Context<UiContextValue>;

export interface UiProviderProps {
  store?: Store | null;
  actions?: Actions | null;
  children?: ReactNode;
}

/** Provide a store and actions to the views and hooks below. */
export function UiProvider(props: UiProviderProps): ReactNode;

/** The store and the action registry of the closest provider. */
export function useUiContext(): UiContextValue;

/** Element properties by name, positional values named by the vocabulary. */
export type UiProps = Readonly<Record<string, readonly RawValue[]>>;

/**
 * Subscribe to a slice of a store; re-renders only when the selected value
 * differs by `isEqual` (default `Object.is`).
 */
export function useUiStore<T>(
  store: Store | null | undefined,
  selector: (store: Store) => T,
  isEqual?: (a: T, b: T) => boolean
): T;

/** The view of one element; re-renders only when it changes. */
export function useUiElement(
  id: string,
  store?: Store
): ElementView | undefined;

/** The values of one property; re-renders only when they change. */
export function useUiProp(
  id: string,
  name: string,
  store?: Store
): readonly RawValue[] | undefined;

/** Every property of an element by name. */
export function useUiProps(id: string, store?: Store): UiProps | undefined;

/** Handle an action by name while the component is mounted. */
export function useUiAction(name: string, handler: ActionHandler): void;

export function propsOf(view: ElementView): UiProps;
export function propOf(
  view: ElementView,
  name: string
): readonly RawValue[] | undefined;
