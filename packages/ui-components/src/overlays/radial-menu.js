/** Radial items translate without rotating labels; narrow viewports use a menu. */
import { atomOf, listen, make, registerOverlay } from './dom.js';
import { createMenu } from './menu.js';
import { radialLayout } from './radial-geometry.js';

export function createRadialMenu(node, initial, ctx) {
  let el = initial;
  const layout = () => {
    const radius = Math.max(0, Number(atomOf(el, 'radius') ?? 108));
    const diameter = radius * 2 + 180;
    const win = ctx.document.defaultView;
    const linear =
      atomOf(el, 'presentation') === 'linear' ||
      win.innerWidth < diameter + 16 ||
      win.innerHeight < diameter + 16;
    node.dataset.presentation = linear ? 'linear' : 'radial';
    node.style.setProperty('--ui-radial-size', `${diameter}px`);
    radialLayout(menu.items().length, {
      radius,
      startAngle: Number(atomOf(el, 'start-angle') ?? -90),
    }).forEach(({ x, y }, index) => {
      const item = menu.items()[index];
      item.style.transform = linear
        ? ''
        : `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    });
  };
  const menu = createMenu(node, el, ctx, {
    radial: true,
    onOpen: () => layout(),
  });
  const detach = listen(ctx.document.defaultView, 'resize', layout);
  return {
    ...menu,
    update(next, changed) {
      el = next;
      menu.update(el, changed);
      layout();
    },
    disconnect() {
      detach();
      menu.disconnect();
    },
  };
}
registerOverlay(
  'radial-menu',
  (el, ctx) => make(ctx.document, 'div', { hidden: true }),
  createRadialMenu
);
