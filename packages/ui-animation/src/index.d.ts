/// <reference lib="dom" />

/**
 * Type declarations of `@link-foundation/ui-animation` (see README.md).
 */

import type { Diagnostic } from '@link-foundation/ui-core';

export type { Diagnostic };

/** Resolves a token path (`motion.duration.short`) to its value. */
export type ResolveToken = (path: string) => unknown;

/** Milliseconds, or a `(token PATH)` reference. */
export type Time = number | { type: 'token'; path: string };

export type Easing =
  | { type: 'linear' }
  | { type: 'named'; name: string }
  | { type: 'cubic-bezier'; points: [number, number, number, number] }
  | {
      type: 'steps';
      count: number;
      position: 'start' | 'end' | 'both' | 'none';
    }
  | { type: 'spring'; stiffness: number; damping: number; mass: number };

export type Quantity = { value: number; unit: string };

/** `(envelope bell|sustain [(attack TIME)] [(release TIME)])` (ms). */
export type Envelope = {
  type: 'bell' | 'sustain';
  attack?: number;
  release?: number;
};

export type AnimValue =
  | { type: 'number'; value: number }
  | { type: 'color'; color: Record<string, unknown> }
  | { type: 'text'; parts: (string | Quantity)[] }
  | { type: 'token'; path: string };

export interface Key {
  /** 0..1 */
  offset: number;
  value: AnimValue;
  /** The easing of the segment that starts at this key. */
  easing: Easing | null;
}

export interface Track {
  /** A CSS property, or a non-CSS property (`text`, `label`, ...). */
  property: string;
  keys: Key[];
}

export interface EffectUse {
  name: string;
  params: Record<string, unknown>;
}

export interface AnimationFields {
  target: string | null;
  /** `null`: the settle time of a spring easing, else 0. */
  duration: Time | null;
  delay: Time;
  /** `Infinity` for `(iterations infinite)`. */
  iterations: number;
  direction: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';
  fill: 'none' | 'forwards' | 'backwards' | 'both' | 'auto';
  composite: 'replace' | 'add' | 'accumulate';
  easing: Easing | null;
  tracks: Track[];
  effect: EffectUse | null;
  /** `(persist true)`: a final clip-path/transform value may persist. */
  persist: boolean;
  envelope: Envelope | null;
}

export interface Animation extends AnimationFields {
  id: string;
  kind: 'animation';
  /** The states of `(on STATE)` that play this animation on its target. */
  triggers: string[];
  /** The fields of the `(reduced-motion ...)` block. */
  reducedMotion: Partial<AnimationFields> | null;
}

export type TimelineItem =
  | {
      type: 'play';
      id: string;
      target: string | null;
      targets: string[] | null;
    }
  | { type: 'sequence' | 'parallel'; items: TimelineItem[] }
  | { type: 'at'; time: Time; items: TimelineItem[] }
  | {
      type: 'stagger';
      step: Time;
      items: TimelineItem[];
      targets: string[] | null;
    };

export interface Timeline {
  id: string;
  kind: 'timeline';
  items: TimelineItem[];
}

export interface Trigger {
  state: string;
  /**
   * The element whose state fires the trigger: the element that has the
   * `(on STATE ...)` sublink, or the target of an animation that has it.
   */
  element: string;
  animation: string;
  /** Where the animation plays; `null`: on `element`. */
  target: string | null;
}

export interface AnimationModel {
  animations: Map<string, Animation>;
  timelines: Map<string, Timeline>;
  triggers: Trigger[];
  diagnostics: Diagnostic[];
}

export const ANIMATION_STATES: readonly string[];
export const ANIMATION_DEFAULTS: Readonly<AnimationFields>;
export function loadAnimations(text: string): AnimationModel;

// Easing

export type EasingFn = (t: number) => number;
export interface Spring {
  /** The position (0 -> 1) at `tMs` milliseconds. */
  at(tMs: number): number;
  /** When it stays within 0.05% of 1 (ms); `Infinity` without damping. */
  settleTime: number;
}
export const NAMED_EASINGS: Readonly<Record<string, readonly number[]>>;
export const SPRING_TOLERANCE: number;
export function isEasingName(name: string): boolean;
export const linear: EasingFn;
export function cubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): EasingFn;
export function steps(
  n: number,
  position?: 'start' | 'end' | 'both' | 'none'
): EasingFn;
export function spring(options?: {
  stiffness?: number;
  damping?: number;
  mass?: number;
}): Spring;
export function springEasing(s: Spring): EasingFn;
export function toCssLinear(fn: EasingFn, samples?: number): string;
export function easingFunction(
  easing: Easing | null,
  resolveToken?: ResolveToken
): EasingFn;
export function easingCss(
  easing: Easing | null,
  resolveToken?: ResolveToken
): string;

// Sampling

export interface SampleOptions {
  resolveToken?: ResolveToken;
  /** The seed of effects without `(seed ...)`. */
  seed?: number | string;
  /** The text an effect works on. */
  input?: string;
}
export type SampledValues = Record<string, number | string | unknown>;
export function sample(
  animation: Animation,
  tMs: number,
  options?: SampleOptions
): SampledValues;
export function sampleTyped(
  animation: Animation,
  tMs: number,
  options?: SampleOptions
): {
  active: boolean;
  values: Map<string, AnimValue>;
  effects: Record<string, unknown>;
};
export function envelopeWeight(
  envelope: Envelope | null,
  progress: number,
  duration: number
): number;

export interface Layer {
  animation: Animation;
  /** When the layer starts (ms). */
  start?: number;
  seed?: number | string;
  input?: string;
}
export function sampleLayers(
  layers: (Animation | Layer)[],
  tMs: number,
  options?: SampleOptions
): SampledValues;

// Random

export function seededRandom(seed: number | string): () => number;
export function seedNumber(seed: number | string): number;
export function hashString(text: string): number;
export function mix(...parts: (number | string)[]): number;

// Effects

export type EffectFn = (
  input: string,
  progress: number,
  seed: number | string,
  params: Record<string, unknown>
) => unknown;
export function registerEffect(
  name: string,
  fn: EffectFn,
  options?: { property?: string }
): void;
export function getEffect(
  name: string
): { fn: EffectFn; property: string } | undefined;
export function effectNames(): string[];
export const DECIPHER_CHARACTERS: string;
export function decipher(
  input: string,
  progress: number,
  seed?: number | string
): string;
export function revealOrder(text: string, random: () => number): number[];
export function decipherFrame(
  text: string,
  progress: number,
  order: number[],
  random: () => number
): string;

// Validation

export interface FlashLimits {
  maxFlashes: number;
  minChange: number;
  darkerBelow: number;
  sampleRate: number;
  windowMs: number;
}
export interface ValidateOptions {
  resolveToken?: ResolveToken;
  flash?: Partial<FlashLimits>;
}
export const PERSIST_PROPERTIES: readonly string[];
export const FLASH_PROPERTIES: readonly string[];
export const FLASH_LIMITS: Readonly<FlashLimits>;
export function luminanceChanges(
  series: { t: number; l: number }[],
  limits?: FlashLimits
): number[];
export function validateAnimation(
  animation: Animation,
  options?: ValidateOptions
): Diagnostic[];
export function validateAnimations(
  model: AnimationModel,
  options?: ValidateOptions
): Diagnostic[];

// WAAPI

export interface WaapiAnimation {
  keyframes: Record<string, string | number | null>[];
  options: {
    duration: number;
    easing: string;
    fill: string;
    composite: string;
    delay?: number;
    iterations?: number;
    direction?: string;
  };
}
export const NON_CSS_PROPERTIES: readonly string[];
export function isCssProperty(property: string): boolean;
export function keyframeProperty(property: string): string;
export function toWaapi(
  animation: Animation,
  options?: {
    resolveToken?: ResolveToken;
    isCssProperty?: (property: string) => boolean;
  }
): WaapiAnimation;

// Timing and timelines

export interface Timing {
  delay: number;
  duration: number;
  iterations: number;
  direction: string;
  fill: string;
  easing: EasingFn;
  active: number;
}
export const MOVEMENT_PROPERTIES: readonly string[];
export function resolveTiming(
  animation: Animation,
  resolveToken?: ResolveToken
): Timing;
export function timingAt(
  timing: Timing,
  tMs: number
): { iteration: number; progress: number; eased: number; phase: string } | null;
export function endTime(
  animation: Animation,
  resolveToken?: ResolveToken
): number;
export function reducedMotionVariant(animation: Animation): Animation;
export function flattenTimeline(
  model: AnimationModel,
  id: string,
  options?: {
    resolveToken?: ResolveToken;
    variant?: (animation: Animation) => Animation;
    target?: string | null;
  }
): { start: number; id: string; target: string | null }[];

// Values and tokens

export function readValue(raw: string): AnimValue;
export function interpolate(
  from: AnimValue,
  to: AnimValue,
  progress: number
): AnimValue;
export function valueCss(value: AnimValue): string;
export function relativeLuminance(color: Record<string, unknown>): number;
export function tokenResolver(
  tokens: Map<string, { value: unknown }>
): ResolveToken;

// Player

export interface Clock {
  now(): number;
  requestFrame(callback: (time: number) => void): unknown;
  cancelFrame(id: unknown): void;
}
export interface ManualClock extends Clock {
  /** Move the time forward by `ms`, one frame (`step` ms) at a time. */
  advance(ms: number, step?: number): void;
  readonly pending: number;
}
/** One frame at 60 Hz (ms). */
export const FRAME_MS: number;
export function createManualClock(start?: number): ManualClock;
export function systemClock(): Clock;
export type Motion = 'full' | 'reduced';
export function defaultMotion(element: Element | null): Motion;

export interface PlayOptions {
  /** Where to play (default: the animation's own target). */
  target?: string;
  seed?: number | string;
  input?: string;
}

export interface PlayControl {
  /** Resolves when every run has finished; rejects (AbortError) on cancel. */
  finished: Promise<void>;
  readonly currentTime: number;
  readonly runs: {
    id: string;
    element: Element | null;
    start: number;
    end: number;
  }[];
  pause(): void;
  play(): void;
  seek(ms: number): void;
  cancel(): void;
  /** The sampled values at the current time on `target`. */
  values(target?: string): SampledValues;
}

export type ElementSource =
  | { nodeFor(id: string): Element | null }
  | ((id: string) => Element | null)
  | null
  | undefined;

export interface PlayerOptions {
  /** Links Notation text or a loaded model. */
  animations?: string | AnimationModel;
  clock?: Clock;
  motion?: Motion | ((element: Element | null) => Motion);
  animate?: (
    element: Element,
    keyframes: object[],
    options: object
  ) => {
    finished?: Promise<unknown>;
    currentTime?: number | null;
    pause?(): void;
    play?(): void;
    cancel?(): void;
  };
  resolveToken?: ResolveToken;
  seed?: number | string;
  isCssProperty?: (property: string) => boolean;
  apply?: (element: Element, property: string, value: unknown) => void;
}

export interface StoreLike {
  get(
    id: string
  ): { properties?: { name: string; values: unknown[] }[] } | null | undefined;
  subscribe(listener: (events: object[]) => void): () => void;
}

export interface Player {
  model: AnimationModel;
  load(source: string | AnimationModel): AnimationModel;
  play(id: string, options?: PlayOptions): PlayControl;
  /** Play `(on STATE ...)` triggers on store state changes; returns unsubscribe. */
  bindTriggers(store: StoreLike): () => void;
  motion(id: string): Motion;
}

/** The plays that fire when element `id` enters `state`. */
export function triggersFor(
  model: AnimationModel,
  store: StoreLike,
  id: string,
  state: string
): { animation: string; target: string }[];

export function createPlayer(
  handle: ElementSource,
  options?: PlayerOptions
): Player;
