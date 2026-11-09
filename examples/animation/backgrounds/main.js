import { parseNested } from '@link-foundation/ui-core';
import { mount as stars } from '@link-foundation/ui-animation/backgrounds/starfield.js';
import { mount as shader } from '@link-foundation/ui-animation/backgrounds/shader.js';
import { nebula } from '@link-foundation/ui-animation/backgrounds/nebula.js';
import { mount as beams } from '@link-foundation/ui-animation/backgrounds/beams.js';
import { mount as rain } from '@link-foundation/ui-animation/backgrounds/rain.js';
import { mount as grid } from '@link-foundation/ui-animation/backgrounds/grid.js';

const text = await (await fetch('./look.lino')).text();
const root = parseNested(text)[0];
const look = Object.fromEntries(
  root.values.slice(1).map((layer) => {
    const name = layer.values[0].id;
    const entries = layer.values.slice(1).map((property) => {
      const [key, value] = property.values;
      const number = Number(value.id);
      return [key.id, Number.isFinite(number) ? number : value.id];
    });
    return [name, Object.fromEntries(entries)];
  })
);
const at = (id) => document.getElementById(id);
const layers = [];
const shaderLayer = shader(at('nebula'), nebula({ order: 0 }));
layers.push(shaderLayer);
const starLayer = stars(at('stars'), { ...look.stars, order: 1 });
layers.push(starLayer);
const beamLayer = beams(at('beams'), { ...look.beams, order: 3 });
const rainLayer = rain(at('rain'), { ...look.rain, order: 4 });
layers.push(beamLayer, rainLayer);
const gridLayer = grid(at('grid'), {
  ...look.grid,
  order: 2,
  onDrift(drift) {
    beamLayer.update({ drift });
    rainLayer.update({ drift });
  },
});
layers.push(gridLayer);
at('pause').addEventListener('click', () => {
  const paused = at('pause').getAttribute('aria-pressed') !== 'true';
  at('pause').setAttribute('aria-pressed', String(paused));
  layers.forEach((layer) => layer.animate(!paused));
});
window.addEventListener(
  'pagehide',
  () => layers.forEach((layer) => layer.dispose()),
  { once: true }
);
document.documentElement.dataset.backgroundsReady = 'true';
