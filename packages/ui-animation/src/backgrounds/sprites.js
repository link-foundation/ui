import { radians } from './common.js';

/** Original normalized sprite outlines, drawn once per look/DPR. */
function outline(Path, shape) {
  const p = new Path();
  if (shape === 'dot' || shape === 'soft-dot' || shape === 'ring') {
    p.arc(0, 0, 1, 0, Math.PI * 2);
  } else if (shape === 'square') {
    p.rect(-0.8, -0.8, 1.6, 1.6);
  } else if (
    shape === 'cross' ||
    shape === 'cross-x' ||
    shape === 'telescope-flare'
  ) {
    p.moveTo(-1, 0);
    p.lineTo(1, 0);
    p.moveTo(0, -1);
    p.lineTo(0, 1);
    if (shape === 'telescope-flare') {
      p.arc(0, 0, 0.25, 0, Math.PI * 2);
    }
  } else {
    const points =
      { diamond: 2, 'star-4': 4, 'star-5': 5, 'star-6': 6, sparkle: 4 }[
        shape
      ] ?? 4;
    for (let i = 0; i < points * 2; i++) {
      const angle = (i * Math.PI) / points - Math.PI / 2;
      const r = i % 2 ? (shape === 'sparkle' ? 0.12 : 0.4) : 1;
      const x = Math.cos(angle) * r,
        y = Math.sin(angle) * r;
      if (i === 0) {
        p.moveTo(x, y);
      } else {
        p.lineTo(x, y);
      }
    }
    p.closePath();
  }
  return p;
}

export function sprite(canvas, win, o, dpr, hue) {
  const image = canvas.ownerDocument.createElement('canvas');
  const extent = Math.ceil((o.size + o.glow * 2 + 4) * dpr);
  image.width = image.height = extent;
  const ctx = image.getContext('2d');
  if (!ctx) {
    throw new Error('Sprite context unavailable');
  }
  ctx.translate(extent / 2, extent / 2);
  ctx.rotate(radians(o.shape === 'cross-x' ? 45 : 0));
  ctx.scale((o.size * dpr) / 2, (o.size * dpr) / 2);
  ctx.fillStyle = ctx.strokeStyle = o.color;
  ctx.filter = `hue-rotate(${hue}deg)`;
  ctx.shadowColor = o.glowColor;
  ctx.shadowBlur = o.glow * dpr;
  const path = outline(win.Path2D, o.shape);
  if (['ring', 'cross', 'cross-x', 'telescope-flare'].includes(o.shape)) {
    ctx.lineWidth = 0.18;
    ctx.stroke(path);
  } else if (o.shape === 'soft-dot') {
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    gradient.addColorStop(0, o.color);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.fill(path);
  } else {
    ctx.fill(path);
  }
  return { image, size: extent / dpr };
}
