import { seededRandom } from '../random.js';
import { mountLayer, changed, clamp, bounded } from './common.js';

const defaults = {
  seed: 224,
  cellSize: 64,
  style: 'comet',
  direction: 'both',
  bothSenses: true,
  count: 8,
  speed: 120,
  length: 180,
  width: 1,
  color: '#88bbff',
  glow: 12,
  pause: 1,
  snap: true,
  drift: 0,
};
function create(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }
  let o,
    area,
    beams = [];
  function seed() {
    const random = seededRandom(o.seed);
    beams = Array.from({ length: Math.round(clamp(o.count, 1, 40)) }, () => ({
      vertical:
        o.direction === 'vertical' ||
        (o.direction === 'both' && random() > 0.5),
      line: random(),
      position: random(),
      speed: 0.75 + random() * 0.5,
      sense: o.bothSenses && random() > 0.5 ? -1 : 1,
      wait: 0,
    }));
  }
  function drawTrail(b, head) {
    const tail = head - b.sense * o.length;
    const gradient = ctx.createLinearGradient(tail, 0, head || 0.001, 0);
    gradient.addColorStop(0, o.style === 'segment' ? o.color : 'transparent');
    gradient.addColorStop(o.style === 'pulse' ? 0.5 : 1, o.color);
    if (o.style === 'pulse') {
      gradient.addColorStop(1, 'transparent');
    }
    ctx.strokeStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(tail, 0);
    ctx.lineTo(head, 0);
    ctx.stroke();
  }
  function drawBeam(b, dt, still) {
    const extent = b.vertical ? area.height : area.width;
    if (!still && b.wait > 0) {
      b.wait -= dt;
      return;
    }
    if (!still) {
      b.position += (o.speed * b.speed * dt) / extent;
    }
    if (b.position > 1 + o.length / extent) {
      b.position = -o.length / extent;
      b.wait = o.pause;
    }
    const across = b.line * (b.vertical ? area.width : area.height);
    const line =
      (o.snap ? Math.round(across / o.cellSize) * o.cellSize : across) +
      (b.vertical ? 0 : o.drift);
    const head = b.sense > 0 ? b.position * extent : (1 - b.position) * extent;
    ctx.save();
    if (b.vertical) {
      ctx.translate(line, 0);
      ctx.rotate(Math.PI / 2);
    } else {
      ctx.translate(0, line);
    }
    ctx.shadowColor = o.color;
    ctx.shadowBlur = o.glow;
    ctx.lineWidth = o.width;
    if (o.style === 'scan') {
      const acrossExtent = b.vertical ? area.width : area.height;
      ctx.fillStyle = o.color;
      ctx.fillRect(head, -acrossExtent, o.width, acrossExtent * 2);
    } else {
      drawTrail(b, head);
    }
    ctx.restore();
  }
  return {
    defaults,
    update(next, before) {
      o = bounded(next, {
        cellSize: [32, 128],
        count: [1, 40],
        speed: [20, 1500],
        length: [10, 800],
        width: [0.5, 8],
        glow: [0, 40],
        pause: [0, 10],
      });
      if (
        area &&
        changed(next, before, [
          'cellSize',
          'direction',
          'bothSenses',
          'seed',
          'snap',
        ])
      ) {
        seed();
      } else if (area && next.count !== before.count) {
        const current = beams;
        seed();
        beams = beams.map((beam, i) => current[i] ?? beam);
      }
      return changed(
        next,
        before,
        Object.keys(defaults).filter((key) => !['speed', 'pause'].includes(key))
      );
    },
    resize(next, old) {
      area = next;
      if (!old) {
        seed();
      }
    },
    draw(dt, { still }) {
      ctx.setTransform(area.ratio, 0, 0, area.ratio, 0, 0);
      ctx.clearRect(0, 0, area.width, area.height);
      beams.forEach((b) => drawBeam(b, dt, still));
    },
  };
}
export const mount = (canvas, options = {}) =>
  mountLayer(canvas, options, create);
