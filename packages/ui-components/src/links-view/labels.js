/** Labels use top-left world-space boxes; padding is in screen pixels. */
export function visibleLabels(
  labels,
  zoom,
  { minZoom = 0.6, padding = 2 } = {}
) {
  if (zoom < minZoom || zoom <= 0) {
    return [];
  }
  const accepted = [];
  const gap = padding / zoom;
  for (const label of [...labels].sort(
    (a, b) => (b.priority ?? 0) - (a.priority ?? 0)
  )) {
    if (
      !accepted.some(
        (other) =>
          label.x < other.x + other.width + gap * 2 &&
          label.x + label.width + gap * 2 > other.x &&
          label.y < other.y + other.height + gap * 2 &&
          label.y + label.height + gap * 2 > other.y
      )
    ) {
      accepted.push(label);
    }
  }
  return accepted.map((label) => label.id);
}
