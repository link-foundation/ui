import type { createEffectGovernor } from '@link-foundation/ui-themes/classic/materials';

export interface LayerHandle<Options = CommonOptions> {
  update(partial: Partial<Options>): void;
  animate(on: boolean): void;
  dispose(): void;
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
