import { seededRandom } from '../random.js';
import { mountLayer, changed, clamp, bounded, radians } from './common.js';
import { sprite } from './sprites.js';

const defaults = {
  count: 160,
  seed: 224,
  shape: 'dot',
  size: 2,
  sizeSpread: 0.5,
  color: '#ffffff',
  hueSpread: 0,
  brightness: 1,
  glow: 0,
  glowColor: '#ffffff',
  twinkleRate: 1,
  twinkleDepth: 0.3,
  rotation: 0,
  spin: 0,
  motion: 'still',
  direction: 90,
  speed: 20,
  streak: 0,
  blend: 'normal',
};
const looks = ['shape', 'size', 'color', 'hueSpread', 'glow', 'glowColor'];

function create(canvas, win) {
  const ctx = canvas.getContext('2d');
  if (!ctx || !win.Path2D) {
    return null;
  }
  let o,
    area,
    stars = [],
    sprites = [],
    dirty = true,
    twinkleClock = 0,
    rotationClock = 0;
  const seed = () => {
    const random = seededRandom(o.seed);
    const count = Math.min(
      6000,
      Math.round(
        (clamp(o.count, 0, 3000) * area.width * area.height) / (1920 * 1080)
      )
    );
    stars = Array.from({ length: count }, () => ({
      x: random(),
      y: random(),
      depth: 0.2 + random() * 0.8,
      phase: random() * Math.PI * 2,
      size: random(),
      hue: Math.floor(random() * 9),
    }));
  };
  const rebuild = () => {
    sprites = Array.from({ length: 9 }, (_, i) =>
      sprite(canvas, win, o, area.dpr, (i / 4 - 1) * o.hueSpread)
    );
    dirty = false;
  };
  function advance(star, dt) {
    const speed = o.speed * star.depth;
    if (o.motion === 'drift') {
      star.x =
        (star.x +
          (Math.cos(radians(o.direction)) * speed * dt) / area.width +
          1) %
        1;
      star.y =
        (star.y +
          (Math.sin(radians(o.direction)) * speed * dt) / area.height +
          1) %
        1;
    } else if (o.motion === 'warp') {
      star.x = (0.5 + (star.x - 0.5) * (1 + (speed * dt) / 200) + 1) % 1;
      star.y = (0.5 + (star.y - 0.5) * (1 + (speed * dt) / 200) + 1) % 1;
    } else if (o.motion === 'orbit') {
      const x = (star.x - 0.5) * area.width,
        y = (star.y - 0.5) * area.height;
      const angle = (speed * dt) / Math.max(40, Math.hypot(x, y));
      star.x = 0.5 + (x * Math.cos(angle) - y * Math.sin(angle)) / area.width;
      star.y = 0.5 + (x * Math.sin(angle) + y * Math.cos(angle)) / area.height;
    }
  }
  return {
    defaults,
    update(next, before) {
      o = bounded(next, {
        count: [0, 3000],
        size: [0.5, 24],
        sizeSpread: [0, 1],
        hueSpread: [0, 180],
        brightness: [0, 1],
        glow: [0, 40],
        twinkleRate: [0, 5],
        twinkleDepth: [0, 1],
        rotation: [0, 180],
        spin: [-180, 180],
        direction: [0, 360],
        speed: [0, 400],
        streak: [0, 20],
      });
      dirty ||= changed(next, before, looks);
      if (area && changed(next, before, ['count', 'seed'])) {
        seed();
      }
      return changed(
        next,
        before,
        Object.keys(defaults).filter(
          (key) => !['twinkleRate', 'spin', 'direction'].includes(key)
        )
      );
    },
    resize(next, old) {
      area = next;
      if (!old || changed(next, old, ['width', 'height'])) {
        seed();
      }
      dirty ||= !old || next.dpr !== old.dpr;
    },
    draw(dt, { still }) {
      if (dirty) {
        rebuild();
      }
      twinkleClock += still ? 0 : dt * o.twinkleRate;
      rotationClock += still ? 0 : dt * o.spin;
      ctx.setTransform(area.ratio, 0, 0, area.ratio, 0, 0);
      ctx.clearRect(0, 0, area.width, area.height);
      ctx.globalCompositeOperation =
        { normal: 'source-over', add: 'lighter', screen: 'screen' }[o.blend] ??
        'source-over';
      for (const star of stars) {
        if (!still) {
          advance(star, dt);
        }
        const item = sprites[star.hue];
        const size = item.size * (1 - o.sizeSpread * star.size);
        ctx.globalAlpha = clamp(
          o.brightness *
            (1 -
              o.twinkleDepth *
                (0.5 +
                  0.5 * Math.sin(twinkleClock * Math.PI * 2 + star.phase))),
          0,
          1
        );
        ctx.save();
        ctx.translate(star.x * area.width, star.y * area.height);
        ctx.rotate(radians(o.rotation + rotationClock));
        ctx.drawImage(
          item.image,
          -size / 2,
          -size / 2,
          size * (1 + (still ? 0 : (o.streak * o.speed) / 400)),
          size
        );
        ctx.restore();
      }
    },
  };
}

/** Mount one star layer; stack up to four canvases with independent options. */
export const mount = (canvas, options = {}) =>
  mountLayer(canvas, options, create);
