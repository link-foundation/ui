// Prints the numbers geometry.test.js pins, and cross-checks them against a
// brute-force polyline (1e6 steps) computed independently of the quadrature.
import {
  linkGeometry,
  cubicPoint,
  pointAtLength,
} from '../../packages/ui-components/src/links-view/geometry.js';
function brute(path, steps = 200000) {
  const pts = [];
  path.forEach((s, i) => {
    for (let k = i === 0 ? 0 : 1; k <= steps; k++) {
      pts.push(cubicPoint(s, k / steps));
    }
  });
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(
      cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
    );
  }
  const total = cum.at(-1);
  const half = total / 2;
  const j = cum.findIndex((c) => c >= half);
  const f = (half - cum[j - 1]) / (cum[j] - cum[j - 1]);
  return {
    total,
    center: {
      x: pts[j - 1].x + (pts[j].x - pts[j - 1].x) * f,
      y: pts[j - 1].y + (pts[j].y - pts[j - 1].y) * f,
    },
  };
}
for (const opts of [
  { source: { x: 0, y: 0 }, target: { x: 100, y: 0 } },
  { source: { x: 0, y: 0 }, target: { x: 100, y: 0 }, bend: 0.25 },
  { source: { x: 10, y: 20 }, target: { x: 130, y: 70 }, bend: -0.3 },
  { source: { x: 0, y: 0 }, target: { x: 0, y: 0 } },
]) {
  const g = linkGeometry(opts);
  const b = brute(g.path);
  console.log(JSON.stringify(opts), 'center', g.center, 'length', g.length);
  console.log('   brute', b.center, b.total, 'q1', pointAtLength(g.path, 0.25));
}
