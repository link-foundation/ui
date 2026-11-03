import { networkIds } from '../network-model.js';

/** Fit normalized deterministic placements inside a padded viewport. */
export function regular(network, options, place) {
  const { width = 640, height = 400 } = options;
  const ids = networkIds(network);
  const positions = ids.map((id, i) => [id, place(i, ids.length)]);
  const xs = positions.map(([, p]) => p.x);
  const ys = positions.map(([, p]) => p.y);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs);
  const minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const scale = Math.min(
    Math.max(1, width - 64) / (maxX - minX || 1),
    Math.max(1, height - 64) / (maxY - minY || 1)
  );
  return new Map(
    positions.map(([id, p]) => [
      id,
      {
        x: width / 2 + (p.x - (minX + maxX) / 2) * scale,
        y: height / 2 + (p.y - (minY + maxY) / 2) * scale,
      },
    ])
  );
}
