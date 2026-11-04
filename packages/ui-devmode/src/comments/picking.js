import { lasso } from './geometry.js';

/** Capture selection gestures before application/designer handlers. */
export function installCommentPicking({
  window,
  root,
  view,
  nodes,
  select,
  selection,
  listen,
  close,
}) {
  let mode = 'pick';
  let points = null;
  let pointer = null;
  const setMode = (next) => {
    points = null;
    pointer = null;
    view.path.removeAttribute('d');
    mode = next;
    view.pick.setAttribute('aria-pressed', String(mode === 'pick'));
    view.lasso.setAttribute('aria-pressed', String(mode === 'lasso'));
  };
  const own = (event) => event.composedPath().includes(view.host);
  const target = (event) =>
    nodes().find(({ node }) => event.composedPath().includes(node))?.id;
  const pickTarget = (event) => {
    const path = event.composedPath();
    return (
      nodes()
        .filter(({ node }) => path.includes(node))
        .sort((a, b) => path.indexOf(a.node) - path.indexOf(b.node))[0]?.id ??
      target(event)
    );
  };
  const stop = (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  const cancel = () => {
    points = null;
    pointer = null;
    view.path.removeAttribute('d');
  };
  listen(
    window,
    'keydown',
    (event) => {
      if (event.key !== 'Escape') {
        return;
      }
      stop(event);
      if (points) {
        cancel();
      } else if (mode !== 'off') {
        setMode('off');
      } else {
        close();
      }
    },
    true
  );
  listen(
    window,
    'pointermove',
    (event) => {
      if (!points || pointer !== event.pointerId) {
        return;
      }
      stop(event);
      if (points.length < 2048) {
        points.push({ x: event.clientX, y: event.clientY });
      }
      view.path.setAttribute(
        'd',
        `${points.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ')} Z`
      );
    },
    true
  );
  const gesture = (type, event) => {
    if (type === 'pointerdown' && event.button === 0 && mode === 'lasso') {
      pointer = event.pointerId;
      points = [{ x: event.clientX, y: event.clientY }];
    } else if (type === 'pointerup' && points && pointer === event.pointerId) {
      const ids = lasso(
        nodes().map(({ id, node }) => ({ id, ...rectOf(node) })),
        points
      );
      select(event.shiftKey ? [...selection(), ...ids] : ids);
      cancel();
    }
  };
  const clickPick = (event) => {
    if (mode === 'pick') {
      const id = pickTarget(event);
      if (id) {
        const previous = selection();
        select(
          event.shiftKey || event.ctrlKey || event.metaKey
            ? previous.includes(id)
              ? previous.filter((value) => value !== id)
              : [...previous, id]
            : [id]
        );
      }
    }
  };
  for (const type of [
    'pointerdown',
    'pointerup',
    'pointercancel',
    'mousedown',
    'mouseup',
    'click',
    'dblclick',
    'auxclick',
  ]) {
    listen(
      window,
      type,
      (event) => {
        if (own(event) || mode === 'off') {
          if (type === 'pointerup' || type === 'pointercancel') {
            cancel();
          }
          return;
        }
        if (type === 'pointercancel') {
          cancel();
          return;
        }
        if (!points && !event.composedPath().includes(root)) {
          return;
        }
        stop(event);
        if (type === 'click') {
          clickPick(event);
        } else {
          gesture(type, event);
        }
      },
      true
    );
  }
  listen(window, 'blur', cancel);
  listen(window, 'scroll', cancel, true);
  return { setMode, destroy: cancel };
}
const rectOf = (node) => {
  const { x, y, width, height } = node.getBoundingClientRect();
  return { x, y, width, height };
};
