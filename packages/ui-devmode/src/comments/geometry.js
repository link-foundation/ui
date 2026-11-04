/** Freehand lasso in viewport CSS pixels. Enclosing containers are excluded. */
const cross = (a, b, p) =>
  (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
const onSegment = (a, b, p) =>
  Math.abs(cross(a, b, p)) < 1e-8 &&
  p.x >= Math.min(a.x, b.x) &&
  p.x <= Math.max(a.x, b.x) &&
  p.y >= Math.min(a.y, b.y) &&
  p.y <= Math.max(a.y, b.y);
const intersects = (a, b, c, d) =>
  onSegment(a, b, c) ||
  onSegment(a, b, d) ||
  onSegment(c, d, a) ||
  onSegment(c, d, b) ||
  (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0);

function inside(p, polygon) {
  let yes = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (onSegment(a, b, p)) {
      return true;
    }
    if (
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    ) {
      yes = !yes;
    }
  }
  return yes;
}

export function lasso(rects, polygon) {
  if (polygon.length < 3) {
    return [];
  }
  return rects
    .filter((r) => {
      if (r.width <= 0 || r.height <= 0) {
        return false;
      }
      const corners = [
        { x: r.x, y: r.y },
        { x: r.x + r.width, y: r.y },
        { x: r.x + r.width, y: r.y + r.height },
        { x: r.x, y: r.y + r.height },
      ];
      if (corners.some((p) => inside(p, polygon))) {
        return true;
      }
      return corners.some((a, i) =>
        polygon.some((c, j) =>
          intersects(
            a,
            corners[(i + 1) % 4],
            c,
            polygon[(j + 1) % polygon.length]
          )
        )
      );
    })
    .map((r) => r.id);
}
