export interface Material {
  color: string;
  opacity: number;
  blur: number;
  noise: number;
  refraction: number;
}
export interface ViewerPreferences {
  motion?: boolean;
  sound?: boolean;
  volume?: number;
  transparency?: boolean;
}
export interface EffectState extends ViewerPreferences {
  visible?: boolean;
  reducedMotion?: boolean;
}
export function readMaterial(text: string): Material;
export function materialStyle(
  material: Material,
  preferences?: ViewerPreferences
): Record<string, string>;
export function applyAppearancePreset<
  T extends { preferences: ViewerPreferences },
>(current: T, preset: Partial<T>): T;
export function createEffectGovernor(options?: {
  requestFrame?: (callback: (time: number) => void) => number;
  cancelFrame?: (id: number) => void;
  onSound?: (event: unknown, volume: number) => void;
}): {
  set(patch: EffectState): void;
  add(
    id: string,
    draw: (time: number, state: EffectState) => boolean | void
  ): () => void;
  sound(event: unknown): void;
  dispose(): void;
};
