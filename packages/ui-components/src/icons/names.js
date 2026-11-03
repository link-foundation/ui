/**
 * The logical icon names every icon set answers to. The own set
 * (assets/icons/own/) draws all of them; the adapters map each one to an
 * icon of their library.
 */

/** The logical names, in gallery order. */
export const ICON_NAMES = Object.freeze([
  'close',
  'menu',
  'more',
  'chevron-up',
  'chevron-down',
  'chevron-left',
  'chevron-right',
  'check',
  'plus',
  'minus',
  'search',
  'settings',
  'reset',
  'copy',
  'paste',
  'send',
  'attach',
  'drag-handle',
  'dock-left',
  'dock-right',
  'dock-bottom',
  'float',
  'zoom-in',
  'zoom-out',
  'fit',
  'play',
  'pause',
  'record',
  'warning',
  'error',
  'info',
  'link',
]);

/**
 * Icons that point in the reading direction and flip in right-to-left
 * text. Icons named after a physical side (`chevron-left`, `dock-left`)
 * keep their side.
 */
export const MIRROR_IN_RTL = Object.freeze(new Set(['send', 'reset']));

/** The set that `(icon close)` and unknown sets fall back to. */
export const DEFAULT_ICON_SET = 'own';
