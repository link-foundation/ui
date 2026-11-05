/**
 * `chip`: a compact label. With `(removable true)` it has a native remove
 * button, named `Remove LABEL` unless `remove-label` says otherwise (give
 * a translated one in a localized document). A click, Enter, Space, Delete
 * or Backspace removes the chip: it commits `(removed true)` as a
 * `ui-change` event, hides, and passes keyboard focus to the next chip of
 * its row, else the previous one, else the row itself, so focus is never
 * lost. `(on change ...)` is where a host removes the value it stands for.
 *
 *   (ada: chip Ada (value ada) (removable true)
 *     (on change (emit person-removed)))
 */

import {
  atomOf,
  changesOf,
  commitValue,
  controlOf,
  driveControl,
  flagOf,
  partOf,
  setAttr,
  setText,
  startControl,
  stopControl,
  updateLabel,
} from './dom.js';

export const CHIP_VARIANTS = Object.freeze(['filled', 'outlined']);
export const CHIP_TONES = Object.freeze(['neutral', 'primary', 'error']);

/** The remove button of a chip, when it can take focus. */
const removeOf = (chip) => {
  const button = chip.querySelector(':scope [data-part="remove"]');
  return button && !button.hidden && !button.disabled ? button : null;
};

/** Pass focus on from a chip that is about to hide. */
function passFocus(node) {
  const row = node.parentElement;
  if (row === null) {
    return;
  }
  const chips = [...row.children].filter(
    (child) => child.localName === 'ui-chip' && !child.hidden
  );
  const at = chips.indexOf(node);
  const next = [...chips.slice(at + 1), ...chips.slice(0, at).reverse()]
    .map(removeOf)
    .find(Boolean);
  if (next) {
    next.focus();
  } else {
    row.setAttribute('tabindex', '-1');
    row.focus();
  }
}

function render(control) {
  const { node, parts, service } = control;
  const removed = service.state === 'removed';
  if (removed && parts.remove.ownerDocument.activeElement === parts.remove) {
    passFocus(node);
  }
  node.toggleAttribute('hidden', removed);
  if (!control.driven) {
    commitValue(control, 'removed', removed);
  }
}

export const CHIP_KIND = Object.freeze({
  tag: 'ui-chip',
  childrenSlot: null,
  attributes: { disabled: 'boolean' },
  create(el, ctx) {
    const doc = ctx.document;
    const node = doc.createElement('ui-chip');
    const root = partOf(doc, 'span', 'root');
    const label = partOf(doc, 'span', 'label');
    const remove = partOf(doc, 'button', 'remove', { type: 'button' });
    remove.appendChild(partOf(doc, 'span', 'icon', { 'aria-hidden': 'true' }));
    setText(remove.firstChild, '×');
    root.appendChild(label);
    root.appendChild(remove);
    node.appendChild(root);
    const control = startControl(node, el, ctx, {
      kind: 'chip',
      parts: { root, remove },
      target: node,
      render,
    });
    control.label = label;
    control.value = false;
    return node;
  },
  update(node, el, changed, ctx) {
    const has = changesOf(node, changed);
    const control = controlOf(node);
    const { remove } = control.parts;
    if (has('label')) {
      updateLabel(control.label, el, ctx);
    }
    if (has('label') || has('remove-label')) {
      setAttr(
        remove,
        'aria-label',
        atomOf(el, 'remove-label') ?? `Remove ${atomOf(el, 'label') ?? ''}`.trim()
      );
    }
    if (has('value')) {
      setAttr(node, 'data-value', atomOf(el, 'value'));
    }
    if (has('variant')) {
      const variant = atomOf(el, 'variant');
      setAttr(node, 'variant', CHIP_VARIANTS.includes(variant) ? variant : 'filled');
    }
    if (has('tone')) {
      const tone = atomOf(el, 'tone');
      setAttr(node, 'tone', CHIP_TONES.includes(tone) ? tone : 'neutral');
    }
    if (has('removable')) {
      remove.toggleAttribute('hidden', !flagOf(el, 'removable'));
    }
    const disabled = flagOf(el, 'disabled');
    if (has('disabled')) {
      remove.toggleAttribute('disabled', disabled);
      control.assign({ disabled });
    }
    if (has('removed')) {
      const removed = flagOf(el, 'removed');
      driveControl(control, removed ? 'remove' : 'restore', removed, disabled);
    }
  },
  destroy: stopControl,
});
