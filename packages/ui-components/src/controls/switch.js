/**
 * `switch`: an on/off `<button role=switch aria-checked>` with a track
 * and a thumb; Space, Enter and a click toggle it. Its label is the
 * button's own text, so the name and the switch are one tab stop. A form
 * submits `value` (default `on`) under `name` only while it is on, as a
 * checkbox does (a hidden input).
 *
 *   (dark: switch 'Dark theme' (name dark) (checked true))
 */

import {
  atomOf,
  changesOf,
  commitValue,
  controlOf,
  flagOf,
  partId,
  partOf,
  receive,
  setAttr,
  setText,
  startControl,
  stopControl,
} from './dom.js';

/** Keep the hidden form input in step with the state. */
function render(control) {
  const { checked, disabled } = control.service.context;
  control.hidden.toggleAttribute(
    'disabled',
    checked !== true || disabled === true
  );
  commitValue(control, 'checked', checked === true);
}

export const SWITCH_KIND = Object.freeze({
  tag: 'ui-switch',
  childrenSlot: null,
  attributes: { disabled: 'boolean' },
  create(el, ctx) {
    const doc = ctx.document;
    const node = doc.createElement('ui-switch');
    const input = partOf(doc, 'button', 'input', {
      type: 'button',
      id: partId(el.id),
    });
    const track = partOf(doc, 'span', 'track', { 'aria-hidden': 'true' });
    const thumb = partOf(doc, 'span', 'thumb');
    const label = partOf(doc, 'span', 'label');
    const hidden = partOf(doc, 'input', null, { type: 'hidden', value: 'on' });
    track.appendChild(thumb);
    input.appendChild(track);
    input.appendChild(label);
    node.appendChild(input);
    node.appendChild(hidden);
    const control = startControl(node, el, ctx, {
      kind: 'switch',
      parts: { input, track, thumb, label },
      target: input,
      render: (c) => render(c),
    });
    control.hidden = hidden;
    return node;
  },
  eventTarget: (node) => node.firstChild,
  update(node, el, changed, ctx) {
    const has = changesOf(node, changed);
    const control = controlOf(node);
    const { input, label } = control.parts;
    if (has('label')) {
      const text = atomOf(el, 'label');
      setText(label, text);
      if (text === undefined || text === '') {
        ctx.diagnostic('missing-label', 'error', { property: 'label' });
      }
    }
    if (has('name')) {
      setAttr(control.hidden, 'name', atomOf(el, 'name'));
    }
    if (has('value')) {
      setAttr(control.hidden, 'value', atomOf(el, 'value') ?? 'on');
    }
    if (has('disabled')) {
      const disabled = flagOf(el, 'disabled');
      input.toggleAttribute('disabled', disabled);
      control.assign({ disabled });
    }
    if (has('checked')) {
      const checked = flagOf(el, 'checked');
      receive(control, checked, { checked });
    }
    render(control);
  },
  destroy: stopControl,
});
