/// <reference lib="dom" />
export interface Material {
  color: string;
  opacity: number;
  blur: number;
  noise: number;
  refraction: number;
  saturation?: number;
  brightness?: number;
  contrast?: number;
  tint?: string;
  'tint-level'?: number;
  highlight?: number;
  depth?: number;
  'depth-blur'?: number;
  shadow?: number;
  'shadow-blur'?: number;
  'shadow-distance'?: number;
  'shadow-spread'?: number;
  sheen?: number;
  'sheen-angle'?: number;
  'light-angle'?: number;
  'border-width'?: number;
  'border-light'?: number;
}
export interface ViewerPreferences {
  motion?: boolean | 'auto' | 'on' | 'off';
  sound?: boolean;
  volume?: number;
  transparency?: boolean | 'auto' | 'on' | 'off';
  reducedTransparency?: boolean;
  refractionProvider?: RefractionProvider;
}
export interface EffectState extends ViewerPreferences {
  visible?: boolean;
  reducedMotion?: boolean;
}
export function readMaterial(text: string): Material;
export interface MaterialAppearance {
  readonly material: Readonly<Material>;
  readonly opacity: number;
  readonly transparent: boolean;
  readonly surfaceColor: string;
}
export interface MaterialStyleOptions {
  /** Namespace for generated noise and refraction variables, default "material". */
  prefix?: string;
  /** CSS color expression used for inherited color and theme tint. */
  surfaceColor?: string;
  clipPath?: string;
  /** A CSS background image, called only for visible grain with transparency. */
  texture?: (appearance: MaterialAppearance) => string | null;
  /** Appearance overrides for the dedicated material layer. */
  lighting?: (appearance: MaterialAppearance) => {
    images?: readonly string[];
    shadows?: readonly string[];
    borderColor?: string;
  };
}
export function materialStyle(
  material: Material,
  preferences?: ViewerPreferences,
  options?: MaterialStyleOptions
): Record<string, string>;
export function applyAppearancePreset<
  T extends { preferences: ViewerPreferences },
>(current: T, preset: Partial<T>, keys?: (keyof T)[]): T;
/** Independent quality multipliers, monotonically decreasing until removal. */
export interface EffectQuality {
  scale: number;
  fps: number;
}
export interface QualityOptions {
  /** Disable resolution degradation for crisp layers. Default true. */
  resolution?: boolean;
  /** Resolution floor (0, 1], default 0.4. */
  minScale?: number;
  /** Resolution multiplier (0, 1), default 0.7. */
  scaleFactor?: number;
  /** Frame-rate share floor (0, 1], default 0.25. */
  minFps?: number;
  /** Frame-rate share multiplier (0, 1), default 0.5. */
  fpsFactor?: number;
}
export function createQualityWatcher(options?: QualityOptions): {
  /** Feed a frame gap in milliseconds. True only when a share decreases. */
  feed(gap: number): boolean;
  snapshot(): EffectQuality;
  /** Start a new warm-up window, retaining the current shares. */
  reset(): void;
};
export interface EffectOptions extends QualityOptions {
  /** Target draw rate, 5..60. Omit for every frame at full quality, then a 60 fps base. */
  fps?: number;
  /** Called once per degradation step, before the next draw. */
  onQualityChange?: (quality: EffectQuality) => void;
}
export interface EffectGovernorOptions {
  requestFrame?: (callback: (time: number) => void) => number;
  cancelFrame?: (id: number) => void;
  onSound?: (event: unknown, volume: number) => void;
  watchVisibility?: boolean;
  watchReducedMotion?: boolean;
  document?: Pick<
    Document,
    'hidden' | 'addEventListener' | 'removeEventListener'
  >;
  matchMedia?: (
    query: string
  ) => Pick<
    MediaQueryList,
    'matches' | 'addEventListener' | 'removeEventListener'
  >;
}
export interface EffectGovernor {
  /** Boolean true follows reduced motion; 'on' explicitly overrides it. */
  set(patch: EffectState): void;
  add(
    id: string,
    draw: (
      time: number,
      state: EffectState,
      elapsedSeconds: number,
      quality: EffectQuality
    ) => boolean | void,
    options?: EffectOptions
  ): () => void;
  /** Returns a detached snapshot, or undefined for an unregistered effect. */
  getQuality(id: string): EffectQuality | undefined;
  /** Coalesced repaint with zero elapsed time, even while paused. */
  invalidate(id: string): void;
  sound(event: unknown): void;
  dispose(): void;
}
export function createEffectGovernor(
  options?: EffectGovernorOptions
): EffectGovernor;

export interface RefractionOptions {
  scale?: number;
  detail?: number;
  octaves?: number;
  smoothing?: number;
  seed?: number;
}
export interface RefractionProvider {
  supported: boolean;
  reference(strength: number, preferences?: ViewerPreferences): string;
  dispose(): void;
}
export function createRefractionProvider(
  document?: Document,
  options?: RefractionOptions
): RefractionProvider;
export function observeMaterialVisibility(
  root: Document | Element,
  selector: string,
  options?: {
    margin?: number | string;
    /** Suppress the filter on a host-owned material pseudo-element. */
    pseudoElement?: '::before' | '::after';
    /** Share with a surface's governor: (_, visible) => governor.set({ visible }). */
    onVisibility?: (element: Element, visible: boolean) => void;
  }
): { dispose(): void };
export function opticalMaterialCss(selector?: string): string;
