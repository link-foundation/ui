/**
 * `slider`: a value in a range, set by dragging the thumb (or pressing
 * the track) or with the keys: the arrows step (×10 with Shift; Left and
 * Right swap in right-to-left text), PageUp/PageDown move ten steps,
 * Home/End go to the ends. The thumb is the `slider` role with
 * `aria-valuenow`, `-valuemin`, `-valuemax` and `aria-valuetext`
 * (`value-text` with `{value}` in it, else the number). A drag commits
 * a single value on pointer release; every key commits its new value.
 *
 *   (volume: slider 'Volume' (name volume) (min 0) (max 100) (step 5) (value 40)
 *     (value-text '{value} %'))
 */

import {
  atomOf,
  changesOf,
  commitValue,
  controlOf,
  flagOf,
  isLive,
  maybeNumber,
  numberOf,
  partId,
  partOf,
  receive,
  setAttr,
  startControl,
  stopControl,
  updateLabel,
} from './dom.js';
import { clampStep, nextValue } from './numeric-keys.js';

const DEFAULT_RANGE = Object.freeze({ min: 0, max: 100, step: 1 });

/** The range of the slider context. */
const rangeOf = (context) => ({
  min: context.min,
  max: context.max,
  step: context.step,
});

/** The fraction (0–1) of the range a value is at. */
export function fractionOf(value, { min, max }) {
  if (!(max > min) || !Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

/** The text of a value: the `value-text` template, else the number. */
export const valueText = (template, value) =>
  template === undefined || template === null
    ? String(value)
    : template.replaceAll('{value}', String(value));

/** The value a pointer position on the track stands for. */
function pointerValue(event, track, context) {
  const box = track.getBoundingClientRect();
  const vertical = context.orientation === 'vertical';
  let fraction = vertical
    ? (box.bottom - event.clientY) / (box.height || 1)
    : (event.clientX - box.left) / (box.width || 1);
  const rtl =
    !vertical &&
    track.ownerDocument.defaultView.getComputedStyle(track).direction === 'rtl';
  if (rtl) {
    fraction = 1 - fraction;
  }
  const { min, max } = context;
  return clampStep(min + Math.min(1, Math.max(0, fraction)) * (max - min), {
    ...rangeOf(context),
  });
}

/** The machine actions; `pointer` is the pointer event being handled. */
function actionsOf(state) {
  return {
    'numeric-key': ([key, shift], meta) => {
      const { context } = meta;
      const rtl =
        context.orientation !== 'vertical' &&
        state.track.ownerDocument.defaultView.getComputedStyle(state.track)
          .direction === 'rtl';
      const value = nextValue(key, {
        ...rangeOf(context),
        value: context.value,
        shift: shift === 'shift',
        rtl,
      });
      if (value !== null) {
        meta.assign({ value });
      }
    },
    'move-to-pointer': (args, meta) => {
      if (state.pointer !== null) {
        meta.assign({
          value: pointerValue(state.pointer, state.track, meta.context),
        });
      }
    },
  };
}

/** Capture the pointer on the track while dragging; focus the thumb. */
function trackPointer(state, thumb) {
  const { track } = state;
  const hold = (event) => {
    state.pointer = event.type === 'lostpointercapture' ? null : event;
    if (event.type === 'pointerdown' && event.button === 0) {
      track.setPointerCapture?.(event.pointerId);
      thumb.focus();
      event.preventDefault();
    }
  };
  for (const type of [
    'pointerdown',
    'pointermove',
    'pointerup',
    'lostpointercapture',
  ]) {
    track.addEventListener(type, hold, true);
  }
  return () => {
    for (const type of [
      'pointerdown',
      'pointermove',
      'pointerup',
      'lostpointercapture',
    ]) {
      track.removeEventListener(type, hold, true);
    }
  };
}

/** Show the value; commit it unless a drag is going on. */
function render(control) {
  const { context, state } = control.service;
  const fraction = fractionOf(context.value, context);
  control.node.style.setProperty('--ui-slider-fraction', String(fraction));
  setAttr(control.hidden, 'value', String(context.value));
  const text = valueText(control.template, context.value);
  if (context.text !== text) {
    control.assign({ text });
    return;
  }
  if (state !== 'dragging') {
    commitValue(control);
  }
}

export const SLIDER_KIND = Object.freeze({
  tag: 'ui-slider',
  childrenSlot: null,
  attributes: { disabled: 'boolean', orientation: 'string' },
  create(el, ctx) {
    const doc = ctx.document;
    const node = doc.createElement('ui-slider');
    const labelId = partId(el.id, 'label');
    const label = partOf(doc, 'span', 'label', { id: labelId });
    const track = partOf(doc, 'span', 'track');
    const indicator = partOf(doc, 'span', 'indicator', {
      'aria-hidden': 'true',
    });
    const thumb = partOf(doc, 'span', 'thumb', {
      id: partId(el.id),
      tabindex: '0',
      'aria-labelledby': labelId,
    });
    const hidden = partOf(doc, 'input', null, { type: 'hidden' });
    track.appendChild(indicator);
    track.appendChild(thumb);
    node.appendChild(label);
    node.appendChild(track);
    node.appendChild(hidden);
    const state = { track, pointer: null };
    const control = startControl(node, el, ctx, {
      kind: 'slider',
      parts: { label, track, indicator, thumb },
      target: thumb,
      actions: actionsOf(state),
      context: { ...DEFAULT_RANGE, value: DEFAULT_RANGE.min },
      render: (c) => render(c),
    });
    control.hidden = hidden;
    if (isLive(ctx)) {
      const release = trackPointer(state, thumb);
      const stop = control.stop;
      control.stop = () => {
        release();
        stop();
      };
    }
    return node;
  },
  eventTarget: (node) => node.children[1].children[1],
  update(node, el, changed, ctx) {
    const has = changesOf(node, changed);
    const control = controlOf(node);
    const { thumb } = control.parts;
    if (has('label')) {
      updateLabel(control.parts.label, el, ctx);
    }
    if (has('name')) {
      setAttr(control.hidden, 'name', atomOf(el, 'name'));
    }
    if (has('value-text')) {
      control.template = atomOf(el, 'value-text');
    }
    const patch = {};
    for (const name of ['min', 'max', 'step']) {
      if (has(name)) {
        patch[name] = maybeNumber(el, name) ?? DEFAULT_RANGE[name];
      }
    }
    if (has('orientation')) {
      patch.orientation =
        atomOf(el, 'orientation') === 'vertical' ? 'vertical' : 'horizontal';
    }
    if (has('disabled')) {
      patch.disabled = flagOf(el, 'disabled');
      setAttr(thumb, 'tabindex', patch.disabled ? '-1' : '0');
      control.hidden.toggleAttribute('disabled', patch.disabled);
    }
    control.assign(patch);
    if (Object.keys(patch).length > 0 || has('value')) {
      const range = rangeOf(control.service.context);
      const value = clampStep(numberOf(el, 'value', range.min), range);
      receive(control, value, {
        text: valueText(control.template, value),
      });
    }
  },
  destroy: stopControl,
});
