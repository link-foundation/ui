import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
} from 'd3-force';
import { networkIds, networkEdges } from '../network-model.js';
import { grid } from './grid.js';
import { regular } from './regular.js';

/** Fixed seed, no timers, at most 300 synchronous ticks (normally in a worker). */
export function createForceSimulation(network, options = {}) {
  const {
    width = 640,
    height = 400,
    alphaMin = 0.001,
    maxTicks = 300,
    pins = [],
  } = options;
  const initial = grid(network, options);
  const fixed = new Map(pins);
  const nodes = networkIds(network).map((id) => ({
    id,
    ...initial.get(id),
    ...(fixed.has(id) ? { fx: fixed.get(id).x, fy: fixed.get(id).y } : {}),
  }));
  let seed = 42;
  const random = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const simulation = forceSimulation(nodes)
    .stop()
    .randomSource(random)
    .alphaMin(Math.max(0.000001, alphaMin))
    .force('charge', forceManyBody().strength(-35))
    .force(
      'links',
      forceLink(networkEdges(network))
        .id((node) => node.id)
        .distance(40)
    )
    .force('center', forceCenter(width / 2, height / 2));
  let ticks = 0;
  const limit = Math.max(1, Math.min(300, maxTicks));
  return {
    get ticks() {
      return ticks;
    },
    tick() {
      if (ticks >= limit || simulation.alpha() < simulation.alphaMin()) {
        return false;
      }
      simulation.tick();
      ticks++;
      return ticks < limit && simulation.alpha() >= simulation.alphaMin();
    },
    positions: () => new Map(nodes.map(({ id, x, y }) => [id, { x, y }])),
  };
}

export function force(network, options = {}) {
  const simulation = createForceSimulation(network, options);
  while (simulation.tick()) {
    /* bounded above by 300 */
  }
  const raw = simulation.positions();
  const ids = networkIds(network);
  const fitted = regular(network, options, (i) => raw.get(ids[i]));
  for (const [id, point] of options.pins ?? []) {
    if (fitted.has(id)) {
      fitted.set(id, point);
    }
  }
  return fitted;
}
