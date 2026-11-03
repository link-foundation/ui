import type { Store } from '@link-foundation/ui-store';
import type { mountDocument, render } from '@link-foundation/ui-dom';
import type {
  ActionFn,
  ActionRegistry,
  Clock,
  Diagnostic,
  Guard,
  HostActions,
  Machine,
  Service,
} from './index.js';

export interface BehaviorOptions {
  actions?: ActionRegistry | Record<string, ActionFn>;
  host?: HostActions;
  machines?: Record<string, Machine | string>;
  referenceMachines?: boolean;
  guards?: Record<string, Guard>;
  clock?: Clock;
}

export interface BehaviorHandle {
  store: Store;
  handle: ReturnType<typeof render>;
  registry: ActionRegistry;
  diagnostics: Diagnostic[];
  serviceFor(id: string): Service | null;
  destroy(): void;
}

export const BEHAVIOR_CSS: string;

export function mountBehavior(
  container: Element,
  text: string,
  options?: BehaviorOptions & NonNullable<Parameters<typeof mountDocument>[2]>
): BehaviorHandle;
