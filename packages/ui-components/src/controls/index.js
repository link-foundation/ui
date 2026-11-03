/**
 * The basic controls of ui-components: one module per kind (button,
 * text-field, select, ...), each a ui-dom kind renderer that runs the
 * control's behaviour machine (`machines/<kind>.lino`) over native
 * elements in light DOM, with Open UI part names in `data-part`.
 *
 * `registerControls()` registers every control kind with ui-dom
 * (`defineKind`), or into a kinds Map/object for the `kinds` render
 * option. `mountControls(container, text, options)` mounts a document with
 * `mountBehavior` and writes every value a control commits to the store as
 * one `setProp` before the element's `(on change ...)` handlers run.
 */

import { defineKind } from '@link-foundation/ui-dom';
import { mountBehavior } from '../behavior/dom.js';
import { AVATAR_KIND } from './avatar.js';
import { BADGE_KIND } from './badge.js';
import { BUTTON_KIND } from './button.js';
import { CHECKBOX_KIND } from './checkbox.js';
import { COLOR_FIELD_KIND } from './color-field.js';
import { COMBOBOX_KIND } from './combobox.js';
import { ICON_BUTTON_KIND } from './icon-button.js';
import { LABEL_KIND } from './label.js';
import { LINK_KIND } from './link.js';
import { NUMBER_FIELD_KIND } from './number-field.js';
import { OPTION_KIND } from './option.js';
import { PROGRESS_KIND } from './progress.js';
import { RADIO_GROUP_KIND, RADIO_KIND } from './radio-group.js';
import { SELECT_KIND } from './select.js';
import { SLIDER_KIND } from './slider.js';
import { SWITCH_KIND } from './switch.js';
import { TEXT_AREA_KIND } from './text-area.js';
import { TEXT_FIELD_KIND } from './text-field.js';

export {
  controlKindMeta,
  controlKindNames,
  controlsVocabulary,
  CONTROL_KINDS_TEXT,
} from './vocabulary.js';
export { CONTROL_MACHINES } from './machines/index.js';
export { formatHex, parseHex } from './color.js';
export { clampStep, decimalsOf, nextValue } from './numeric-keys.js';
export { ID_PREFIX, partId } from './dom.js';
export { initialsOf } from './avatar.js';
export { isUrl } from './link.js';
export { formatNumber, readNumber } from './number-field.js';
export { fractionOf, valueText } from './slider.js';
export { filterOptions } from './combobox.js';
export { BADGE_TONES } from './badge.js';

/** The kind renderer of every basic control, by kind name. */
export const CONTROL_KIND_SPECS = Object.freeze({
  button: BUTTON_KIND,
  'icon-button': ICON_BUTTON_KIND,
  label: LABEL_KIND,
  link: LINK_KIND,
  'text-field': TEXT_FIELD_KIND,
  'text-area': TEXT_AREA_KIND,
  'number-field': NUMBER_FIELD_KIND,
  'color-field': COLOR_FIELD_KIND,
  checkbox: CHECKBOX_KIND,
  'radio-group': RADIO_GROUP_KIND,
  radio: RADIO_KIND,
  switch: SWITCH_KIND,
  slider: SLIDER_KIND,
  select: SELECT_KIND,
  combobox: COMBOBOX_KIND,
  option: OPTION_KIND,
  progress: PROGRESS_KIND,
  badge: BADGE_KIND,
  avatar: AVATAR_KIND,
});

/**
 * Register the control kinds. With no target they are registered with
 * ui-dom (`defineKind`, for every render); with a Map or an object they
 * are added to it (the `kinds` render option of one render).
 * @param {Map<string, object>|Record<string, object>} [target]
 * @returns {string[]} the registered kind names
 */
export function registerControls(target) {
  for (const [kind, spec] of Object.entries(CONTROL_KIND_SPECS)) {
    if (target === undefined) {
      defineKind(kind, spec);
    } else if (target instanceof Map) {
      target.set(kind, spec);
    } else {
      target[kind] = spec;
    }
  }
  return Object.keys(CONTROL_KIND_SPECS);
}

/** The kinds option of a mount: the controls under the caller's kinds. */
function kindsWith(kinds) {
  if (kinds instanceof Map) {
    return new Map([...Object.entries(CONTROL_KIND_SPECS), ...kinds]);
  }
  return { ...CONTROL_KIND_SPECS, ...(kinds ?? {}) };
}

/**
 * Write a committed value to the store: one `setProp` (or `removeProp`
 * for `null`), so it is one transaction and one patch.
 */
function writeChange(store, detail) {
  const { source, property, value } = detail ?? {};
  if (typeof source !== 'string' || !store.has(source)) {
    return;
  }
  if (value === null || value === undefined) {
    store.removeProp(source, property);
  } else {
    store.setProp(source, property, [String(value)]);
  }
}

/**
 * Mount a document whose controls write their values to the store.
 *
 * The container listens to `ui-change` in the capture phase, so the store
 * holds the new value when the `(on change ...)` handlers of the element
 * run. A link click is offered to the `navigate` action when the host
 * handles navigation (`host.navigate` or an own action registry); an
 * unsafe URL is never followed.
 * @param {HTMLElement} container
 * @param {string} text  the document (Links Notation)
 * @param {object} [options]  the options of `mountBehavior`
 */
export function mountControls(container, text, options = {}) {
  const state = { store: null, registry: null };
  const onChange = (event) => {
    if (state.store !== null) {
      writeChange(state.store, event.detail);
    }
  };
  const routed =
    typeof options.host?.navigate === 'function' ||
    typeof options.actions?.dispatch === 'function';
  const onNavigate = (event) => {
    if (!routed || state.registry === null) {
      return;
    }
    const { source, href } = event.detail ?? {};
    const result = state.registry.dispatch('navigate', [href], {
      source,
      event: 'navigate',
    });
    if (result.ok || result.diagnostic?.code !== 'unhandled-action') {
      event.preventDefault();
    }
  };
  container.addEventListener('ui-change', onChange, true);
  container.addEventListener('ui-navigate', onNavigate);
  const mounted = mountBehavior(container, text, {
    ...options,
    kinds: kindsWith(options.kinds),
  });
  state.store = mounted.store;
  state.registry = mounted.registry;
  return {
    ...mounted,
    destroy() {
      container.removeEventListener('ui-change', onChange, true);
      container.removeEventListener('ui-navigate', onNavigate);
      mounted.destroy();
    },
  };
}
