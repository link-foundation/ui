import type { RawValue, UiDocument, UiNode } from '@link-foundation/ui-core';

export interface Diagnostic {
  readonly code: string;
  readonly severity: 'error' | 'warning' | 'info';
  readonly message: string;
  readonly at: Readonly<Record<string, unknown>>;
}

/** A step of a transition, an entry or an exit. */
export interface Action {
  type: string;
  args: RawValue[];
}

export interface Transition {
  /** The next state; `null` keeps the state (actions only). */
  target: string | null;
  actions: Action[];
  /** Guard names; all must pass. */
  guards: string[];
}

export interface DelayedTransition extends Transition {
  /** Milliseconds. */
  delay: number;
}

export interface StateNode {
  entry: Action[];
  exit: Action[];
  on: Record<string, Transition[]>;
  after: DelayedTransition[];
}

export interface PartSpec {
  attrs: { name: string; value: RawValue }[];
  keys: { key: string; event: string }[];
  events: { event: string; send: string }[];
}

export interface Machine {
  id: string | null;
  initial: string | null;
  context: Record<string, unknown>;
  actions: Record<string, Action[]>;
  states: Record<string, StateNode>;
  parts: Record<string, PartSpec>;
}

export type MachineSource = string | UiDocument | UiNode | object;

export interface ParseMachineOptions {
  parseOptions?: object;
}

export function parseMachine(
  source: MachineSource,
  options?: ParseMachineOptions
): { machine: Machine | null; diagnostics: Diagnostic[] };
export function parseMachines(
  source: MachineSource,
  options?: ParseMachineOptions
): { machines: Map<string, Machine>; diagnostics: Diagnostic[] };
export function createMachine(
  source: MachineSource,
  options?: ParseMachineOptions
): Machine;
export class MachineError extends Error {
  diagnostics: Diagnostic[];
}
export function parseDelay(raw: RawValue): number;
export function toValue(raw: RawValue): unknown;

export interface MachineEvent {
  type: string;
  [key: string]: unknown;
}

export type Guard = (
  context: Readonly<Record<string, unknown>>,
  event: MachineEvent
) => boolean;

export interface Clock {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface ManualClock extends Clock {
  readonly now: number;
  advance(ms: number): void;
  pending(): number;
}

export function createManualClock(): ManualClock;

/** The text of an attribute value form, or `null` to leave it out. */
export function attrValue(
  raw: RawValue,
  state: string,
  context: Readonly<Record<string, unknown>>
): string | null;

export interface Snapshot {
  readonly state: string;
  readonly context: Readonly<Record<string, unknown>>;
  readonly event: MachineEvent | null;
}

export interface Service {
  readonly machine: Machine;
  readonly state: string;
  readonly context: Readonly<Record<string, unknown>>;
  readonly status: 'running' | 'stopped';
  send(event: string | MachineEvent): boolean;
  can(event: string | MachineEvent): boolean;
  subscribe(fn: (snapshot: Snapshot) => void): () => void;
  assign(patch: Record<string, unknown>): void;
  use(effects: Record<string, (...args: any[]) => unknown>): () => void;
  attrs(part: string): Record<string, string>;
  stop(): void;
}

export interface InterpretOptions {
  actions?: ActionRegistry | Record<string, ActionFn>;
  guards?: Record<string, Guard>;
  clock?: Clock;
  context?: Record<string, unknown>;
  onDiagnostic?: (diagnostic: Diagnostic) => void;
}

export function interpret(
  machine: Machine | string,
  options?: InterpretOptions
): Service;

export interface ActionMeta {
  source?: string | null;
  event?: string;
  state?: string;
  context?: Readonly<Record<string, unknown>>;
  assign?: (patch: Record<string, unknown>) => void;
  effects?: Record<string, (...args: any[]) => unknown>;
}

export type ActionFn = (args: readonly unknown[], meta: ActionMeta) => unknown;

export interface DispatchResult {
  ok: boolean;
  value?: unknown;
  diagnostic?: Diagnostic;
}

export interface ActionRegistry {
  register(name: string, fn: ActionFn): () => void;
  has(name: unknown): boolean;
  names(): string[];
  dispatch(
    name: unknown,
    args?: readonly unknown[],
    meta?: ActionMeta
  ): DispatchResult;
}

export interface HostActions {
  navigate?(target: string, meta: ActionMeta): unknown;
  emit?(event: string, args: readonly unknown[], meta: ActionMeta): unknown;
  set?(
    target: string,
    property: string,
    value: unknown,
    meta: ActionMeta
  ): unknown;
  toggle?(target: string, property: string, meta: ActionMeta): unknown;
  focus?(target: string, meta: ActionMeta): unknown;
}

export interface ActionRegistryOptions {
  onUnknown?: (diagnostic: Diagnostic) => void;
  onDiagnostic?: (diagnostic: Diagnostic) => void;
  host?: HostActions;
  defaults?: boolean;
}

export function createActionRegistry(
  options?: ActionRegistryOptions
): ActionRegistry;
export function dispatchHandler(
  registry: ActionRegistry,
  values: readonly unknown[],
  meta?: ActionMeta
): DispatchResult[];
export function checkHandler(
  registry: ActionRegistry,
  values: readonly unknown[],
  at?: Record<string, unknown>
): Diagnostic[];
export function fail(code: string, at?: Record<string, unknown>): never;
export const VOCABULARY_ACTIONS: readonly string[];

export function diagnostic(
  code: string,
  severity: 'error' | 'warning' | 'info',
  at?: Record<string, unknown>
): Diagnostic;
export function isUnsafeUrl(url: unknown): boolean;

export const TOGGLE_MACHINE: string;
export const DISCLOSURE_MACHINE: string;
export const REFERENCE_MACHINES: Readonly<Record<string, string>>;
