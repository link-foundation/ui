import { seededRandom } from '../random.js';
import { mountLayer, changed, clamp, bounded, wrapGrid } from './common.js';
import { alphaCleanup } from './rain-cleanup.js';

const defaultPaint = (ctx, glyph, x, y, size) => {
  ctx.font = `${size}px monospace`;
  ctx.fillText(String(glyph), x, y);
};
const defaults = {
  seed: 224,
  cellSize: 64,
  step: 105,
  columnSteps: 4,
  density: 0.35,
  restart: 0.03,
  fade: 0.075,
  glow: 10,
  padding: 2,
  color: '#77ffaa',
  visible: true,
  drift: 0,
  paint: defaultPaint,
  pick: undefined,
  random: seededRandom,
  calibration: 'rolling',
  originX: 0,
  originY: 0,
};

/** Quantize to whole measured display frames; never take two steps in one frame. */
export function createCadence(mode = 'rolling') {
  const gaps = [];
  let frameMs = 1000 / 60;
  let frames = 0;
  const batched = mode === 'batched';
  return {
    frame(gap) {
      if (gap <= 0 || gap >= 100 || !Number.isFinite(gap)) {
        return;
      }
      gaps.push(gap);
      if (batched && gaps.length < 30) {
        return;
      }
      if (gaps.length > 30) {
        gaps.shift();
      }
      const sorted = gaps.toSorted((a, b) => a - b);
      const middle = Math.floor(sorted.length / 2);
      frameMs = sorted[middle];
      if (batched) {
        gaps.length = 0;
      } else if (sorted.length % 2 === 0) {
        frameMs = (frameMs + sorted[middle - 1]) / 2;
      }
    },
    ready(step, fps) {
      frames++;
      const count = Math.max(
        1,
        Math.round(Math.max(clamp(step, 20, 400), 1000 / fps) / frameMs)
      );
      if (frames < count) {
        return false;
      }
      frames = 0;
      return true;
    },
    reset() {
      frames = 0;
      if (batched) {
        gaps.length = 0;
      }
    },
  };
}

function shiftCanvas(canvas, ctx, dx, dy) {
  if (!dx && !dy) {
    return;
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'copy';
  ctx.globalAlpha = 1;
  ctx.drawImage(canvas, dx, dy);
  ctx.restore();
}

function stillField(ctx, area, columns, o, glyph) {
  ctx.clearRect(0, 0, area.width, area.height);
  const fieldRandom = o.random(o.seed);
  for (const column of columns) {
    if (!column.active) {
      continue;
    }
    for (let y = 0; y < area.height; y += o.cellSize / 2) {
      glyph(
        {
          ...column,
          y,
          glyph:
            o.pick?.() ??
            String.fromCharCode(0x30 + Math.floor(fieldRandom() * 10)),
        },
        0,
        0.2 + fieldRandom() * 0.6
      );
    }
  }
  ctx.globalAlpha = 1;
}

function create(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }
  const cleanup = alphaCleanup(canvas, ctx);
  let cadence,
    o,
    area,
    columns = [],
    random,
    steps = 0,
    cleanupTime = 0,
    previousX = 0,
    previousY = 0;
  const pick = () =>
    o.pick?.() ?? String.fromCharCode(0x30 + Math.floor(random() * 10));
  function seed() {
    random = o.random(o.seed);
    const spacing = clamp(o.cellSize, 32, 128) / 2;
    columns = Array.from(
      { length: Math.ceil(area.width / spacing) },
      (_, i) => ({
        x: i * spacing,
        y: Math.floor((random() * area.height) / spacing) * spacing,
        active: random() < o.density,
        every: 1 + Math.floor(random() * clamp(o.columnSteps, 1, 8)),
        glyph: pick(),
      })
    );
  }
  function glyph(column, glow, alpha = 1) {
    const spacing = o.cellSize / 2;
    const padding = clamp(o.padding, 0, Math.min(16, (o.cellSize * 3) / 8));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = o.color;
    ctx.shadowColor = o.color;
    ctx.shadowBlur = glow;
    o.paint(
      ctx,
      column.glyph,
      column.x + padding + wrapGrid(o.originX, spacing),
      column.y + o.drift + wrapGrid(o.originY, spacing),
      Math.max(1, spacing - padding),
      glow
    );
    ctx.shadowBlur = 0;
  }
  return {
    defaults,
    frame: (gap) => cadence.frame(gap),
    cadence: (fps) => cadence.ready(o.step, fps),
    resetClock: () => cadence.reset(),
    update(next, before) {
      o = bounded(next, {
        cellSize: [32, 128],
        step: [20, 400],
        columnSteps: [1, 8],
        density: [0.05, 1],
        restart: [0.005, 0.5],
        fade: [0.01, 0.5],
        glow: [0, 40],
        padding: [0, 16],
      });
      if (!cadence || next.calibration !== before.calibration) {
        cadence = createCadence(o.calibration);
      }
      if (area && changed(next, before, ['cellSize', 'seed', 'random'])) {
        seed();
      } else if (area && next.density !== before.density) {
        const active = o.random(o.seed);
        columns.forEach((c) => {
          c.active = active() < o.density;
        });
      }
      if (area && next.columnSteps !== before.columnSteps) {
        const speed = o.random(o.seed);
        columns.forEach((c) => {
          c.every = 1 + Math.floor(speed() * clamp(o.columnSteps, 1, 8));
        });
      }
      return changed(
        next,
        before,
        Object.keys(defaults).filter(
          (key) =>
            !['step', 'columnSteps', 'restart', 'fade', 'calibration'].includes(
              key
            )
        )
      );
    },
    resize(next, old) {
      area = next;
      if (!old || next.width !== old.width) {
        seed();
      }
    },
    draw(dt, { still, frame }) {
      ctx.setTransform(area.ratio, 0, 0, area.ratio, 0, 0);
      // Round the absolute offset so subpixel deltas accumulate across frames.
      const spacing = o.cellSize / 2;
      const x = Math.round(wrapGrid(o.originX, spacing) * area.ratio);
      const y = Math.round(
        (o.drift + wrapGrid(o.originY, spacing)) * area.ratio
      );
      shiftCanvas(canvas, ctx, x - previousX, y - previousY);
      previousX = x;
      previousY = y;
      if (!o.visible) {
        return;
      }
      if (still) {
        stillField(ctx, area, columns, o, glyph);
        return;
      }
      // An invalidation is a repaint, never a simulation step or extra fade.
      if (!frame) {
        columns.filter((c) => c.active).forEach((c) => glyph(c, o.glow));
        return;
      }
      steps++;
      cleanupTime += dt || o.step / 1000;
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = clamp(o.fade, 0.01, 0.5);
      ctx.fillRect(0, 0, area.width, area.height);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      for (const column of columns) {
        if (!column.active || steps % column.every) {
          continue;
        }
        glyph(column, 0);
        column.y += o.cellSize / 2;
        if (column.y > area.height || random() < clamp(o.restart, 0.005, 0.5)) {
          column.y = 0;
        }
        column.glyph = pick();
        glyph(column, o.glow);
      }
      if (cleanupTime >= 1) {
        cleanup.run();
        cleanupTime %= 1;
      }
    },
    dispose: cleanup.dispose,
  };
}
export const mount = (canvas, options = {}) =>
  mountLayer(canvas, options, create);
