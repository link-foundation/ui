/** Floating UI positioning, shared with select (#34); fixed coordinates also
 * work in the top layer. Dependency injection keeps geometry tests DOM-free. */
import {
  autoUpdate,
  computePosition,
  flip,
  offset,
  shift,
  size,
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
          ...(options.size
            ? [
                size({
                  padding: 8,
                  apply({ availableWidth, availableHeight, rects }) {
                    if (!active) {
                      return;
                    }
                    const bounds = options.size();
                    Object.assign(floating.style, {
                      boxSizing: 'border-box',
                      width: `${Math.max(0, Math.min(availableWidth, Math.max(rects.reference.width, bounds.minWidth ?? 0)))}px`,
                      maxWidth: `${Math.max(0, availableWidth)}px`,
                      maxHeight: `${Math.max(0, Math.min(availableHeight, bounds.maxHeight ?? Infinity))}px`,
                      overflowY: 'auto',
                    });
                  },
                }),
              ]
            : []),
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
