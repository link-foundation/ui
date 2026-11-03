/** Runs the README example of renderLinkSvg (no DOM needed). */
import {
  linkColors,
  linkGeometry,
  renderLinkSvg,
} from '@link-foundation/ui-components';

const geometry = linkGeometry({
  source: { x: 0, y: 0 },
  target: { x: 100, y: 0 },
});
const svg = renderLinkSvg(geometry, {
  width: 320,
  height: 200,
  colors: linkColors(),
  ends: { source: 'bar', target: 'arrow' },
});
console.log(svg.length, svg.slice(0, 120));
