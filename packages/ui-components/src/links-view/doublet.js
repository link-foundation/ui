import { doubletPairs, readDoubletOptions } from './doublet-options.js';
import { doubletGeometry } from './doublet-geometry.js';
import { doubletToSvg } from './doublet-svg.js';
import { compensatedMarker } from './doublet-markers.js';
import { createCollisionSolver } from './collision-job.js';
import { applyDoubletSolution } from './doublet-solution.js';

export { doubletGeometry } from './doublet-geometry.js';

function isUnchanged(frame, solution) {
  return (
    frame?.options?.frame &&
    solution.delta.every((pair) => pair.every((v) => v === 0)) &&
    frame.curves.every(({ id }) => {
      const gaps = frame.options.links[id]?.gaps;
      return [0, 1, 2, 3].every(
        (i) => (gaps?.[i] ?? null) === (solution.linkGaps[id - 1]?.[i] ?? null)
      );
    })
  );
}

/** Built-in provider for createNetworkPresentation and <links-network>. */
export function createDoubletProvider({ debug, ...worker } = {}) {
  const solve = createCollisionSolver(worker);
  return {
    geometry({ input }) {
      const frame = doubletGeometry(input.items, input.options, input.index);
      debug?.('doublet:geometry', {
        links: frame.pairs.length,
        transform: frame.transform,
        margin: frame.margin,
      });
      return frame;
    },
    async solve({ input, frame, signal }) {
      const solution = await solve(input.items, input.options, { signal });
      const options =
        solution.before && solution.frame && !isUnchanged(frame, solution)
          ? applyDoubletSolution(input.options, solution)
          : input.options;
      debug?.('doublet:solve', solution);
      return {
        options,
        frame: {
          ...doubletGeometry(input.items, options, input.index),
          solution,
        },
      };
    },
    svg({ frame }) {
      if (!frame?.curves) {
        throw new TypeError('A prepared doublet frame is required');
      }
      return doubletToSvg(frame);
    },
  };
}

/** Reports geometry/style controls that can affect this network and options. */
export function doubletOptionAvailability(items, options = '') {
  const pairs = doubletPairs(items),
    o = readDoubletOptions(options, pairs.length);
  const loop = pairs.some((p, i) => p.includes(i + 1)),
    free = pairs.some((p) => p.includes(0));
  const referenceCounts = pairs.map(
    (p, i) => p.filter((id) => id !== 0 && id !== i + 1).length
  );
  const reference = referenceCounts.some((count) => count > 0);
  const singleReference = referenceCounts.includes(1);
  const result = {
    ...Object.fromEntries(Object.keys(o).map((key) => [key, true])),
    loop,
    loopBend: loop,
    free,
    bulge: loop || singleReference,
    tension: reference || free,
    angles: reference,
    sourceAngle: reference && o.angles === 'fixed',
    targetAngle: reference && o.angles === 'fixed',
    turns: pairs.length > 0,
    order:
      pairs.length > 1 &&
      (o.layout === 'circle' || (o.layout === 'auto' && pairs.length <= 4)),
    columns:
      ['grid', 'hex', 'dice'].includes(o.layout) ||
      (o.layout === 'auto' && pairs.length > 4),
    layoutAspect: pairs.length > 1,
    spread: pairs.length > 1,
    rotation: pairs.length > 0,
    padding: !o.frame,
    start: pairs.length > 0,
    end: pairs.length > 0,
    middle: pairs.length > 0,
    backgroundAngle: o.background.type === 'linear',
    captionText: o.caption.mode === 'custom',
    cardWidth: o.card.border !== 'none',
    arrowJoin: ['start', 'end', 'middle'].some((key) =>
      ['arrow', 'triangle', 'tail'].includes(o[key].shape)
    ),
    balanceArrows: ['start', 'end'].some((key) =>
      compensatedMarker(o[key], key, { ...o, balanceArrows: true })
    ),
  };
  for (const key of ['start', 'end', 'middle']) {
    Object.assign(result, markerAvailability(key, o[key], pairs.length > 0));
  }
  return Object.assign(result, {
    'background.angle': o.background.type === 'linear',
    'background.color': o.background.type !== 'transparent',
    'background.color2': ['linear', 'radial'].includes(o.background.type),
    'caption.text': o.caption.mode === 'custom',
    'caption.font': o.caption.mode !== 'none',
    'caption.size': o.caption.mode !== 'none',
    'caption.color': o.caption.mode !== 'none',
    'card.width': o.card.border !== 'none',
    'card.borderColor': o.card.border !== 'none',
    'card.color': o.card.opacity > 0,
  });
}
function markerAvailability(key, marker, hasLinks) {
  const visible = hasLinks && marker.shape !== 'none';
  return {
    [`${key}.shape`]: hasLinks,
    [`${key}.size`]: visible,
    [`${key}.offset`]: visible,
    [`${key}.across`]: visible,
    [`${key}.angle`]:
      visible && ['arrow', 'triangle', 'tail'].includes(marker.shape),
    [`${key}.rotation`]: visible && !['circle', 'dot'].includes(marker.shape),
  };
}
export { DOUBLET_MARKERS, readDoubletOptions } from './doublet-options.js';
