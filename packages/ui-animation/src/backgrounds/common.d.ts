import type { createEffectGovernor } from '@link-foundation/ui-themes/classic/materials';

export interface LayerHandle<Options = CommonOptions> {
  update(partial: Partial<Options>): void;
  animate(on: boolean): void;
  dispose(): void;
}
/** A factory for a repeatable stream, called when a layer lays out a scene. */
export type RandomSource = (seed: number | string) => () => number;
export interface GridCoordinates {
  cellSize?: number;
  /** Base grid intersection in CSS pixels, before downward drift. */
  originX?: number;
  originY?: number;
  /** Downward phase in CSS pixels. Use gridOffset() to share a host clock. */
  drift?: number;
}
export interface CommonOptions {
  animate?: boolean;
  fps?: number;
  dprCap?: number;
  /** WebGL only, 0.2..1. */
  resolution?: number;
  adaptive?: boolean;
  level?: number;
  order?: number;
  lightScheme?: boolean;
  lightOpacity?: number;
  reducedMotion?: boolean;
  environment?: Window;
  onError?: (error: unknown) => void;
  governor?: Pick<ReturnType<typeof createEffectGovernor>, 'add'>;
}
