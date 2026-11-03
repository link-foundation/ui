import type { ComponentType, ReactNode } from 'react';
import type { Store, ElementView } from '@link-foundation/ui-store';
import type { UiNode } from '@link-foundation/ui-core';
import type { ActionDetail, Actions } from '@link-foundation/ui-react/hooks';
export { UiProvider } from '@link-foundation/ui-react/hooks';

export interface NativeNode {
  type: 'View' | 'Text' | 'Pressable' | 'Image' | 'ScrollView';
  props: Record<string, unknown>;
  children: (NativeNode | string)[];
}
export type NativeStyle = Record<string, unknown>;
export type Tokens = Record<string, unknown> | Map<string, unknown>;
export interface MappingContext {
  styles?: Record<string, NativeStyle>;
  tokens?: Tokens;
  warn?: (message: string) => void;
}
export interface UiNativeViewProps extends MappingContext {
  source?: string;
  store?: Store;
  actions?: Actions;
  onAction?: (detail: ActionDetail) => void;
  components?: Record<string, ComponentType<{ id: string }>>;
}
export function mapElement(
  node: UiNode | ElementView,
  ctx?: MappingContext
): NativeNode;
export function toNativeStyle(
  declarations?: NativeStyle,
  tokens?: Tokens
): {
  style: NativeStyle;
  warnings: string[];
};
export function createUiNativeView(
  primitives: Record<NativeNode['type'], ComponentType<any> | string>
): (props: UiNativeViewProps) => ReactNode;
export const UiNativeView: (props: UiNativeViewProps) => ReactNode;
