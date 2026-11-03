/**
 * `@link-foundation/ui-components/a11y`: DOM accessibility helpers —
 * focus trap and restoration, roving tabindex, typeahead, key bindings,
 * a shared live region, and `bindMachine` to connect a behaviour machine
 * to elements.
 */

export { trapFocus, restoreFocus, tabbables, FOCUSABLE } from './focus.js';
export { createRovingTabindex } from './roving.js';
export { createTypeahead } from './typeahead.js';
export {
  bindKeys,
  keyOf,
  normalizeKey,
  isTextField,
  firesInField,
} from './keys.js';
export { announce, clearAnnouncements, liveRegion } from './announce.js';
export { bindMachine } from './bind-machine.js';
