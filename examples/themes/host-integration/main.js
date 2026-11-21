/* global document, URL */
import { mount as mountStars } from '@link-foundation/ui-animation/backgrounds/starfield.js';
import { mount as mountShader } from '@link-foundation/ui-animation/backgrounds/shader.js';
import {
  gridOffset,
  mount as mountGrid,
} from '@link-foundation/ui-animation/backgrounds/grid.js';
import { mount as mountBeams } from '@link-foundation/ui-animation/backgrounds/beams.js';
import { mount as mountRain } from '@link-foundation/ui-animation/backgrounds/rain.js';
import {
  framesCss,
  readFrames,
} from '@link-foundation/ui-themes/classic/frames';
import {
  materialStyle,
  observeMaterialVisibility,
  readMaterial,
} from '@link-foundation/ui-themes/classic/materials';

const select = (id) => document.getElementById(id);

// The host owns this generator and can restore the same sequence independently.
function random(seed) {
  let state = [...String(seed)].reduce(
    (value, ch) => (value * 31 + ch.charCodeAt(0)) >>> 0,
    0
  );
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const seed = 'violet';
const spriteColors = ['#d8c2ff', '#f4dba8'];
const createSprites = () =>
  spriteColors.map((color) => {
    const image = document.createElement('canvas');
    image.width = image.height = 5;
    const ctx = image.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(2, 0, 1, 5);
    ctx.fillRect(0, 2, 5, 1);
    return { image, size: 5 };
  });
const layout = ({ random: next }) =>
  Array.from({ length: 28 }, () => ({
    x: (Math.floor(next() * 136) + 4.5) / 144,
    y: (Math.floor(next() * 72) + 4.5) / 80,
    sprite: Math.floor(next() * spriteColors.length),
    opacity: 0.35 + next() * 0.65,
  }));

function paintHostStars(canvas) {
  const ctx = canvas.getContext('2d');
  const sprites = createSprites();
  for (const star of layout({ random: random(seed) })) {
    const { image, size } = sprites[star.sprite];
    ctx.globalAlpha = star.opacity;
    ctx.drawImage(
      image,
      star.x * canvas.width - size / 2,
      star.y * canvas.height - size / 2
    );
  }
}

paintHostStars(select('reference'));
const still = { animate: false, seed, random, dprCap: 1 };
mountStars(select('stars'), { ...still, layout, createSprites });

const shader = mountShader(select('sky'), {
  ...still,
  source: `
    precision mediump float;
    uniform vec2 resolution;
    uniform float sceneTime;
    uniform float offset;
    void main() {
      vec2 uv = gl_FragCoord.xy / resolution;
      float wave = 0.5 + 0.5 * sin(uv.x * 4.0 + uv.y * 4.0 + sceneTime + offset);
      gl_FragColor = vec4(0.11 + 0.28 * wave, 0.08 + 0.15 * uv.y, 0.27 + 0.22 * wave, 1.0);
    }
  `,
  times: { sceneTime: 1, offset: 0 },
  startTime: { offset: 'random' },
});

const coordinates = { cellSize: 48, originX: 9, originY: 8 };
const rain = mountRain(select('rain'), {
  ...still,
  ...coordinates,
  order: 2,
  calibration: 'batched',
  padding: 0,
  color: '#c8a8ef',
  pick: () => 4,
  paint(ctx, size, x, y) {
    ctx.fillRect(x + 5, y + 10, size, 4);
  },
});
const beams = mountBeams(select('beams'), {
  ...still,
  ...coordinates,
  order: 3,
  direction: 'horizontal',
  bothSenses: false,
  color: '#eeccff',
  width: 2,
  glow: 4,
});
const grid = mountGrid(select('grid'), {
  ...still,
  ...coordinates,
  order: 1,
  level: 3,
  tokens: { line: '--host-grid-line', alpha: '--host-grid-alpha' },
  onDrift(drift) {
    rain.update({ drift });
    beams.update({ drift });
  },
});
function seek(ms) {
  shader.update({ clock: { sceneTime: ms / 1000 } });
  grid.update({ drift: gridOffset(ms, coordinates.cellSize, 4800) });
}
seek(1800);

const frameText = await fetch(new URL('./look.lino', import.meta.url)).then(
  (response) => response.text()
);
const frame = framesCss(readFrames(frameText), {
  prefix: 'host-frame',
  scope: '[data-skin="violet"]',
  levels: { panel: ['[data-level="panel"]'], block: ['[data-level="block"]'] },
  paint: false,
});
const sheet = document.createElement('style');
document.head.append(sheet);
const material = readMaterial(`material
  opacity 0.55
  blur 5
  noise 0.35
  border-width 1
`);
const materialSheet = document.createElement('style');
document.head.append(materialSheet);
const rule = (selector, declarations) =>
  `${selector}{${Object.entries(declarations)
    .map(([key, value]) => `${key}:${value};`)
    .join('')}}`;
sheet.textContent =
  frame.properties +
  frame.base +
  Object.values(frame.levels).join('') +
  frame.fit +
  Object.entries(frame.geometry.levels)
    .map(([level, aliases]) =>
      rule(
        `[data-level="${level}"] > .paint::before, [data-level="${level}"] > .paint::after`,
        { ...aliases, ...frame.geometry.fit }
      )
    )
    .join('') +
  rule('.paint::after', frame.geometry.edges.top);
function paintGlass(reducedTransparency) {
  const style = materialStyle(
    material,
    { reducedTransparency },
    {
      prefix: 'host-glass',
      surfaceColor: 'var(--host-glass)',
      clipPath: frame.geometry.material['clip-path'],
      texture: ({ material, opacity }) =>
        `repeating-linear-gradient(112deg, transparent 0 3px, rgb(224 191 255 / ${material.noise * opacity * 0.3}) 4px 5px)`,
      lighting: ({ transparent }) => ({
        images: transparent
          ? [
              'linear-gradient(145deg, color-mix(in srgb, var(--host-light) 26%, transparent), transparent 55%)',
            ]
          : [],
        shadows: ['inset 0 0 1.25rem #21183e80'],
        borderColor: 'var(--host-light)',
      }),
    }
  );
  materialSheet.textContent = rule('.paint::before', style);
}
const reduced = globalThis.matchMedia('(prefers-reduced-transparency: reduce)');
const transparency = select('transparency');
const syncGlass = () =>
  paintGlass(
    reduced.matches || transparency.getAttribute('aria-pressed') === 'true'
  );
syncGlass();
reduced.addEventListener('change', syncGlass);
transparency.addEventListener('click', () => {
  transparency.setAttribute(
    'aria-pressed',
    transparency.getAttribute('aria-pressed') !== 'true'
  );
  syncGlass();
});
const budget = observeMaterialVisibility(document, '.paint', {
  pseudoElement: '::before',
});
globalThis.hostScene = { seek, budget };
