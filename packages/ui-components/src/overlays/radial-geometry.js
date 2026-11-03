/** Pure radial geometry. Angles are degrees, clockwise from the right. */
export function radialLayout(count, { radius = 108, startAngle = -90 } = {}) {
  if (
    !Number.isInteger(count) ||
    count < 0 ||
    !Number.isFinite(radius) ||
    radius < 0 ||
    !Number.isFinite(startAngle)
  ) {
    throw new RangeError(
      'radialLayout: finite radius/angle and non-negative integer count required'
    );
  }
  return Array.from({ length: count }, (_, index) => {
    const angle = startAngle + (index * 360) / count;
    const radians = (angle * Math.PI) / 180;
    return {
      x: radius * Math.cos(radians),
      y: radius * Math.sin(radians),
      angle,
    };
  });
}

/** The center is outside; each sector includes its leading boundary. */
export function sectorAt(dx, dy, count, startAngle = -90) {
  if (
    count <= 0 ||
    !Number.isInteger(count) ||
    (!dx && !dy) ||
    !Number.isFinite(dx + dy + startAngle)
  ) {
    return -1;
  }
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const relative = (((angle - startAngle + 180 / count) % 360) + 360) % 360;
  return Math.floor((relative + 1e-10) / (360 / count)) % count;
}
