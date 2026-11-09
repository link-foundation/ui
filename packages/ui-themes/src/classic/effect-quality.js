/** Internal per-effect watcher. Only valid frame gaps contribute to windows. */
export function createQualityWatcher({
  resolution = true,
  minScale = 0.4,
  scaleFactor = 0.7,
  minFps = 0.25,
  fpsFactor = 0.5,
} = {}) {
  for (const [name, value] of Object.entries({
    minScale,
    scaleFactor,
    minFps,
    fpsFactor,
  })) {
    if (
      !Number.isFinite(value) ||
      value <= 0 ||
      value > 1 ||
      ((name === 'scaleFactor' || name === 'fpsFactor') && value === 1)
    ) {
      throw new RangeError(`Invalid quality option ${name}`);
    }
  }
  let scale = 1,
    fps = 1;
  let frames = 0,
    duration = 0,
    slow = 0,
    warmup = true;
  const resetWindow = () => {
    frames = 0;
    duration = 0;
    slow = 0;
  };
  const snapshot = () => ({ scale, fps });
  return {
    snapshot,
    reset() {
      resetWindow();
      warmup = true;
    },
    feed(gap) {
      if (!Number.isFinite(gap) || gap <= 0 || gap > 1000) {
        return false;
      }
      frames++;
      duration += gap;
      if (gap > 45) {
        slow++;
      }
      if (frames < 30 && duration < 1000) {
        return false;
      }
      const struggling = !warmup && slow > frames / 2;
      warmup = false;
      resetWindow();
      if (!struggling) {
        return false;
      }
      const before = snapshot();
      if (resolution && scale > minScale) {
        // Rounding must not raise a share or pass a configured floor.
        scale = Math.max(
          minScale,
          Math.min(scale, Math.round(scale * scaleFactor * 1000) / 1000)
        );
        if (scale === before.scale) {
          scale = minScale;
        }
      } else {
        fps = Math.max(minFps, fps * fpsFactor);
      }
      return scale < before.scale || fps < before.fps;
    },
  };
}
