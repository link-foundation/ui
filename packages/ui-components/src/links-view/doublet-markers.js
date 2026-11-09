import { add, scale, segmentLength, fmt } from './geometry.js';
import { rotate, radians } from './doublet-layout.js';
import { curveAtDistance } from './doublet-curves.js';

/** Axial painted extension beyond the marker's geometric tip. */
export function markerTipExtension(marker, o) {
  const half = o.strokeWidth / 2,
    sine = Math.sin(radians(marker.angle));
  if (o.arrowJoin === 'round') {
    return half;
  }
  if (o.arrowJoin === 'bevel') {
    return half * sine;
  }
  return half / sine;
}
export function compensatedMarker(marker, end, o) {
  return (
    o.balanceArrows &&
    !marker.explicit.some((name) =>
      ['offset', 'across', 'rotation'].includes(name)
    ) &&
    ((end === 'end' && ['arrow', 'triangle'].includes(marker.shape)) ||
      (end === 'start' && marker.shape === 'tail'))
  );
}
export function markerExtent(marker, o) {
  if (marker.shape === 'none') {
    return 0;
  }
  const tip = ['arrow', 'triangle', 'tail'].includes(marker.shape)
    ? markerTipExtension(marker, o)
    : 0;
  return marker.size + Math.abs(marker.offset) + Math.abs(marker.across) + tip;
}
const coordinate = (x, y) => `${fmt(x, 8)} ${fmt(y, 8)}`;
export function doubletMarkerPath(marker) {
  const { shape, size, angle } = marker,
    r = size / 2;
  const x = size * Math.cos(radians(angle)),
    y = size * Math.sin(radians(angle));
  if (shape === 'none') {
    return '';
  }
  if (shape === 'bar') {
    return `M 0 ${fmt(-r)} L 0 ${fmt(r)}`;
  }
  if (['arrow', 'triangle', 'tail'].includes(shape)) {
    const back = shape === 'tail' ? x : -x;
    return `M ${coordinate(back, -y)} L 0 0 L ${coordinate(back, y)}${shape === 'triangle' ? ' Z' : ''}`;
  }
  if (shape === 'square') {
    return `M ${coordinate(-r, -r)} L ${coordinate(r, -r)} L ${coordinate(r, r)} L ${coordinate(-r, r)} Z`;
  }
  if (shape === 'diamond') {
    return `M ${coordinate(-r, 0)} L ${coordinate(0, -r)} L ${coordinate(r, 0)} L ${coordinate(0, r)} Z`;
  }
  return `M ${fmt(r)} 0 A ${fmt(r)} ${fmt(r)} 0 1 1 ${fmt(-r)} 0 A ${fmt(r)} ${fmt(r)} 0 1 1 ${fmt(r)} 0 Z`;
}

export function placeDoubletMarkers(curve, gaps, o) {
  const lengths = curve.path.map((s) => segmentLength(s)),
    total = lengths[0] + lengths[1];
  return ['start', 'end', 'middle'].map((end) => {
    const marker = o[end],
      compensated = compensatedMarker(marker, end, o);
    let length =
      end === 'start' ? gaps[0] : end === 'end' ? total - gaps[1] : lengths[0];
    length += marker.offset * (end === 'end' ? -1 : 1);
    const extension = compensated ? markerTipExtension(marker, o) : 0;
    const at = curveAtDistance(curve.path, length);
    const normal = rotate(at.direction, 90);
    const compensatedPoint = add(
      at.point,
      scale(
        at.direction,
        extension * (end === 'end' ? -1 : end === 'start' ? 1 : 0)
      )
    );
    const point = add(compensatedPoint, scale(normal, marker.across));
    const angle = (Math.atan2(at.direction.y, at.direction.x) * 180) / Math.PI;
    const rotation = ['none', 'circle', 'dot'].includes(marker.shape)
      ? 0
      : marker.rotation;
    return {
      end,
      marker,
      point,
      angle: angle + rotation,
      compensated,
      extension,
      length,
      anchor: at.point,
      direction: at.direction,
    };
  });
}
export function doubletMarkerSvg(placement, o) {
  const { end, marker, point, angle } = placement;
  if (marker.shape === 'none') {
    return '';
  }
  const fill = ['dot', 'triangle', 'square', 'diamond'].includes(marker.shape)
    ? 'currentColor'
    : 'none';
  const stroke = marker.shape === 'dot' ? 'none' : 'currentColor';
  const limit = Math.max(4, 1 / Math.sin(radians(marker.angle)) + 0.01);
  return `<path data-marker="${marker.shape}" data-end="${end}" d="${doubletMarkerPath(marker)}" transform="translate(${fmt(point.x, 8)} ${fmt(point.y, 8)}) rotate(${fmt(angle, 8)})" fill="${fill}" stroke="${stroke}" stroke-width="${o.strokeWidth}" stroke-linejoin="${o.arrowJoin}" stroke-linecap="butt" stroke-miterlimit="${limit}"></path>`;
}
