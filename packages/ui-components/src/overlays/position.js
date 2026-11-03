/** Floating UI positioning, shared with select (#34); fixed coordinates also
 * work in the top layer. Dependency injection keeps geometry tests DOM-free. */
import {
  autoUpdate,
  computePosition,
  flip,
  offset,
  shift,
} from '@floating-ui/dom';

export function virtualAnchor(x, y, contextElement) {
  return {
    contextElement,
    getBoundingClientRect: () => ({
      x,
      y,
      left: x,
      right: x,
      top: y,
      bottom: y,
      width: 0,
      height: 0,
    }),
  };
}

export function createPositioner(
  dependencies = { autoUpdate, computePosition }
) {
  return (anchor, floating, options = {}) => {
    let active = true;
    const update = async () => {
      const pos = await dependencies.computePosition(anchor, floating, {
        strategy: 'fixed',
        placement: options.placement ?? 'bottom-start',
        middleware: [
          offset(options.offset ?? 8),
          flip(),
          shift({ padding: 8 }),
        ],
      });
      if (active) {
        Object.assign(floating.style, {
          position: 'fixed',
          left: `${pos.x}px`,
          top: `${pos.y}px`,
        });
        options.onUpdate?.(pos);
      }
    };
    const cleanup = dependencies.autoUpdate(anchor, floating, update);
    return () => {
      if (active) {
        active = false;
        cleanup();
      }
    };
  };
}

/** @returns {() => void} stops observers and ignores late positioning results. */
export const positionFloating = createPositioner();
