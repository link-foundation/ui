/**
 * `select`: a select-only combobox (APG) — a button that shows the chosen
 * option and opens a `listbox` of `option` children. The focus stays on
 * the button; the active option is its `aria-activedescendant`. The arrow
 * keys, Home, End, PageUp and PageDown move through the options (and
 * open the list), Enter, Space and a click choose, Escape and leaving
 * close, and typing letters jumps to an option (`createTypeahead`).
 *
 *   (size: select 'Size' (name size) (value m)
 *     (s: option 'Small') (m: option 'Medium') (l: option 'Large'))
 */

import { recordChosen } from './choices.js';
import { connectListPopover } from '../overlays/list-popover.js';
import {
  atomOf,
  changesOf,
  commitValue,
  controlOf,
  flagOf,
  isLive,
  partId,
  partOf,
  receive,
  setAttr,
  setText,
  startControl,
  stopControl,
  updateLabel,
} from './dom.js';
import {
  connectListbox,
  createListState,
  labelAmong,
  listboxActions,
  optionFor,
  optionLabel,
  renderOptions,
} from './listbox.js';

/** Show the chosen option, mark the options, then commit a user change. */
function render(control) {
  const { context } = control.service;
  const { listbox, value: shown } = control.parts;
  const option = control.live ? optionFor(listbox, context.value) : null;
  const label = option ? optionLabel(option) : control.labelOf?.(context.value);
  setText(shown, label ?? control.placeholder ?? '');
  shown.toggleAttribute('data-placeholder', !label);
  setAttr(control.hidden, 'value', context.value ?? '');
  control.hidden.toggleAttribute('disabled', context.value === null);
  if (control.live) {
    renderOptions(listbox, context);
  }
  commitValue(control);
}

/** Send a printable key to the typeahead (the machine binds no letters). */
function typeaheadKeys(control, list, input) {
  const onKeyDown = (event) => {
    if (
      event.key === 'Tab' &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.metaKey
    ) {
      control.service.send('blur');
      return;
    }
    const plain = !event.ctrlKey && !event.altKey && !event.metaKey;
    if (!plain || [...event.key].length !== 1 || event.key === ' ') {
      return;
    }
    list.typed = event.key;
    control.service.send('typeahead');
    list.typed = null;
    event.preventDefault();
  };
  input.addEventListener('keydown', onKeyDown);
  return () => input.removeEventListener('keydown', onKeyDown);
}

function updateNaming(control, el, has) {
  const { input } = control.parts;
  if (
    [
      'label',
      'external-label',
      'aria-label',
      'aria-labelledby',
      'list-label',
      'list-labelledby',
    ].some(has)
  ) {
    const external = flagOf(el, 'external-label');
    control.parts.label.toggleAttribute('hidden', external);
    if (external) {
      setText(control.parts.label, '');
    }
    setAttr(input, 'aria-label', atomOf(el, 'aria-label'));
    setAttr(
      input,
      'aria-labelledby',
      atomOf(el, 'aria-labelledby') ??
        (external || atomOf(el, 'aria-label')
          ? undefined
          : partId(el.id, 'label'))
    );
    setAttr(control.parts.listbox, 'aria-label', atomOf(el, 'list-label'));
    setAttr(
      control.parts.listbox,
      'aria-labelledby',
      atomOf(el, 'list-labelledby') ??
        (external || atomOf(el, 'list-label')
          ? undefined
          : partId(el.id, 'label'))
    );
  }
  for (const name of ['menu-min-width', 'menu-max-height']) {
    if (has(name)) {
      control.node.style.setProperty(`--${name}`, atomOf(el, name) ?? '');
    }
  }
}

export const SELECT_KIND = Object.freeze({
  tag: 'ui-select',
  childrenSlot: (node) => controlOf(node).parts.listbox,
  attributes: { disabled: 'boolean', invalid: 'boolean' },
  create(el, ctx) {
    const doc = ctx.document;
    const node = doc.createElement('ui-select');
    const labelId = partId(el.id, 'label');
    const listboxId = partId(el.id, 'listbox');
    const label = partOf(doc, 'span', 'label', { id: labelId });
    const input = partOf(doc, 'button', 'input', {
      type: 'button',
      id: partId(el.id),
      'aria-labelledby': labelId,
      'aria-controls': listboxId,
    });
    const value = partOf(doc, 'span', 'value');
    const indicator = partOf(doc, 'span', 'indicator', {
      'aria-hidden': 'true',
    });
    input.appendChild(value);
    input.appendChild(indicator);
    const listbox = partOf(doc, 'div', 'listbox', {
      id: listboxId,
      'aria-labelledby': labelId,
      tabindex: '-1',
    });
    const hidden = partOf(doc, 'input', null, { type: 'hidden', disabled: '' });
    for (const part of [label, input, listbox, hidden]) {
      node.appendChild(part);
    }
    const list = createListState(listbox);
    const control = startControl(node, el, ctx, {
      kind: 'select',
      parts: { label, input, value, indicator, listbox },
      target: input,
      actions: listboxActions(list),
      context: { value: null, active: null },
      render: (c) => render(c),
    });
    control.hidden = hidden;
    control.live = isLive(ctx);
    if (control.live) {
      const disconnect = connectListbox(list, control, () => render(control));
      const untype = typeaheadKeys(control, list, input);
      const focus = () => input.focus({ preventScroll: true });
      input.addEventListener('click', focus, true);
      const unpopover = connectListPopover(control);
      const stop = control.stop;
      control.stop = () => {
        disconnect();
        untype();
        input.removeEventListener('click', focus, true);
        unpopover();
        stop();
      };
    }
    return node;
  },
  eventTarget: (node) => node.children[1],
  update(node, el, changed, ctx) {
    const has = changesOf(node, changed);
    const control = controlOf(node);
    const { input } = control.parts;
    if (
      (has('label') || has('external-label')) &&
      !flagOf(el, 'external-label')
    ) {
      updateLabel(control.parts.label, el, ctx);
    }
    updateNaming(control, el, has);
    if (has('name')) {
      setAttr(control.hidden, 'name', atomOf(el, 'name'));
    }
    if (has('placeholder')) {
      control.placeholder = atomOf(el, 'placeholder');
    }
    if (has('required')) {
      setAttr(
        input,
        'aria-required',
        flagOf(el, 'required') ? 'true' : undefined
      );
    }
    for (const name of ['disabled', 'invalid']) {
      if (has(name)) {
        const on = flagOf(el, name);
        if (name === 'disabled') {
          input.toggleAttribute('disabled', on);
        }
        control.assign({ [name]: on });
      }
    }
    if (has('value')) {
      const value = atomOf(el, 'value') ?? null;
      recordChosen(ctx, value);
      control.labelOf = (v) => labelAmong(ctx.children(), v);
      receive(control, value);
    } else {
      render(control);
    }
    control.syncListPopover?.();
  },
  destroy: stopControl,
});
