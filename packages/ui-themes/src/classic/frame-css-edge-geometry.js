import { SIDES } from './frame-css-geometry.js';

/** Paint a full-size polygon band so fractional widths receive the same
 * antialiasing as SVG strokes, including one-pixel edges on the frame boundary. */
export function edgeDeclarations(prefix) {
  const v = (name) => `var(--${prefix}-g-${name})`;
  const edgeCorners = [
    ['tl', 'tr'],
    ['tr', 'br'],
    ['bl', 'br'],
    ['tl', 'bl'],
  ];
  return Object.fromEntries(
    SIDES.map((side, i) => {
      const [start, end] = edgeCorners[i];
      const horizontal = i % 2 === 0;
      const axis = horizontal ? 'w' : 'h';
      const stroke = v(`${side}-stroke`);
      const dimension = horizontal ? '100cqw' : '100cqh';
      const factor = `${v('fit')} * ${v('threshold')} * ${v('border')}`;
      const corner = (id) => `calc(${v(`${id}-${axis}`)} * ${factor})`;
      const room = `max(0px, calc((${dimension} - ${corner(start)} - ${corner(end)}) / 2))`;
      const extent = (id, inset) =>
        `calc(${corner(id)} + min(${room}, calc(${v(`${id}-gap`)} * ${factor} + ${v(`${side}-inset-${inset}`)} * ${v('border')})))`;
      const from = extent(start, 'start'),
        to = `calc(${dimension} - ${extent(end, 'end')})`;
      const center =
        i === 0 || i === 3 ? '0px' : horizontal ? '100cqh' : '100cqw';
      const near = `calc(${center} - ${stroke} / 2)`,
        far = `calc(${center} + ${stroke} / 2)`;
      const points = [
        [from, near],
        [to, near],
        [to, far],
        [from, far],
      ].map((p) => (horizontal ? p : p.toReversed()));
      const coordinates = [];
      const polygon = points
        .map((p, j) =>
          p
            .map((value, k) => {
              const name = `--${prefix}-edge-${side}-${j}-${k}`;
              coordinates.push([name, `calc(${value} + ${stroke})`]);
              return `var(${name})`;
            })
            .join(' ')
        )
        .join(', ');
      const offset = `calc(${from} + ${stroke})`;
      const length = `calc(${to} - ${from})`;
      const normalPosition = `${side} calc(${stroke} / 2)`;
      const along = horizontal ? `left ${offset}` : `top ${offset}`;
      return [
        side,
        Object.fromEntries([
          ['inset', `calc(${stroke} * -1)`],
          ...coordinates,
          ['clip-path', `polygon(${polygon})`],
          ['background-image', v(`${side}-image`)],
          [
            'background-size',
            horizontal
              ? `100% ${v(`${side}-across`)}`
              : `${v(`${side}-across`)} 100%`,
          ],
          ['background-repeat', horizontal ? 'repeat-x' : 'repeat-y'],
          ['background-position', `${along} ${normalPosition}`],
          ['mask-image', v(`${side}-mask`)],
          ['mask-size', horizontal ? `${length} 100%` : `100% ${length}`],
          ['mask-position', horizontal ? `${offset} 0px` : `0px ${offset}`],
          ['mask-repeat', 'no-repeat'],
          ['opacity', `calc(${v('opacity')} * ${v(`${side}-visible`)})`],
        ]),
      ];
    })
  );
}
