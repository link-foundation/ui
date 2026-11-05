/**
 * `combobox`: a text input with a list of suggestions (`option`
 * children) filtered by the text typed (APG list autocomplete). ArrowDown
 * and ArrowUp open the list and move through the matching options (the
 * focus stays in the input), Enter or a click chooses one, Escape closes
 * the list (or clears the text when it is closed). The value is the
 * chosen option's `value`, or the text typed when it names no option.
 *
 *   (city: combobox 'City' (name city)
 *     (ber: option 'Berlin') (lis: option 'Lisbon') (osl: option 'Oslo'))
 */

import { recordChosen } from './choices.js';
import {
  atomOf,
  changesOf,
  commitValue,
  controlOf,
  isLive,
  partId,
  partOf,
  receive,
  setAttr,
  stopControl,
} from './dom.js';
import {
  connectListbox,
  createListState,
  labelAmong,
  listboxActions,
  optionFor,
  optionLabel,
  optionValue,
  optionsOf,
  renderOptions,
} from './listbox.js';
import { createTextControl, inputOf, updateTextControl } from './text-field.js';

const fold = (text) => text.trim().toLocaleLowerCase();

/** Show the options whose label contains `text` (all for `''`). */
export function filterOptions(listbox, text) {
  const query = fold(text);
  for (const option of optionsOf(listbox)) {
    option.toggleAttribute(
      'hidden',
      query !== '' && !fold(optionLabel(option)).includes(query)
    );
  }
}

/** The value of typed text: the value of the option it names, else itself. */
function valueOfText(listbox, text) {
  const query = fold(text);
  if (query === '') {
    return null;
  }
  const option = optionsOf(listbox).find((o) => fold(optionLabel(o)) === query);
  return option ? optionValue(option) : text.trim();
}

function actionsOf(list, input) {
  const base = listboxActions(list);
  const readValue = (args, meta) => {
    meta.assign({ value: valueOfText(list.listbox, input.value) });
  };
  /** Choose an option, and show its label even when the value is the same. */
  const choose = (action) => (args, meta) =>
    action(args, {
      ...meta,
      assign: (patch) => {
        meta.assign(patch);
        const option = optionFor(list.listbox, patch.value);
        if (option) {
          input.value = optionLabel(option);
        }
      },
    });
  return {
    ...base,
    'select-active': (args, meta) =>
      meta.context.active === null || meta.context.active === undefined
        ? readValue(args, meta)
        : choose(base['select-active'])(args, meta),
    'select-picked': choose(base['select-picked']),
    filter: ([which], meta) => {
      filterOptions(list.listbox, which === 'all' ? '' : input.value);
      const active = optionsOf(list.listbox).find(
        (o) => o.id === meta.context.active
      );
      if (active?.hasAttribute('hidden')) {
        meta.assign({ active: null });
      }
    },
    'read-value': readValue,
    'clear-value': (args, meta) => {
      input.value = '';
      filterOptions(list.listbox, '');
      meta.assign({ value: null });
    },
  };
}

/** Show the chosen value as text (when it changed), then commit it. */
function render(control) {
  const { context } = control.service;
  const { input, listbox } = control.parts;
  if (context.value !== control.shown) {
    control.shown = context.value;
    const option = control.live ? optionFor(listbox, context.value) : null;
    const text = option
      ? optionLabel(option)
      : (control.labelOf?.(context.value) ?? context.value ?? '');
    if (input.value !== text) {
      input.value = text;
    }
  }
  if (control.live) {
    renderOptions(listbox, context);
  }
  setAttr(control.hidden, 'value', context.value ?? '');
  control.hidden.toggleAttribute('disabled', context.value === null);
  commitValue(control);
}

export const COMBOBOX_KIND = Object.freeze({
  tag: 'ui-combobox',
  childrenSlot: (node) => controlOf(node).parts.listbox,
  attributes: { disabled: 'boolean', invalid: 'boolean' },
  create(el, ctx) {
    let list = null;
    const node = createTextControl(el, ctx, {
      tag: 'ui-combobox',
      kind: 'combobox',
      attrs: {
        type: 'text',
        autocomplete: 'off',
        'aria-controls': partId(el.id, 'listbox'),
      },
      ignoreInFields: false,
      children: (doc, root) => {
        const listbox = partOf(doc, 'div', 'listbox', {
          id: partId(el.id, 'listbox'),
          tabindex: '-1',
        });
        const hidden = partOf(doc, 'input', null, {
          type: 'hidden',
          disabled: '',
        });
        root.appendChild(listbox);
        root.appendChild(hidden);
        list = createListState(listbox);
        return { listbox };
      },
      actions: (input) => actionsOf(list, input),
      render: (c) => render(c),
    });
    const control = controlOf(node);
    control.hidden = node.children[3];
    control.live = isLive(ctx);
    if (control.live) {
      const disconnect = connectListbox(list, control, () => render(control));
      const stop = control.stop;
      control.stop = () => {
        disconnect();
        stop();
      };
    }
    return node;
  },
  eventTarget: inputOf,
  update(node, el, changed, ctx) {
    const has = changesOf(node, changed);
    const { control } = updateTextControl(node, el, ctx, has);
    if (has('label')) {
      setAttr(control.parts.listbox, 'aria-label', atomOf(el, 'label'));
    }
    if (has('name')) {
      setAttr(control.hidden, 'name', atomOf(el, 'name'));
      control.parts.input.removeAttribute('name');
    }
    if (has('value')) {
      const value = atomOf(el, 'value') ?? null;
      recordChosen(ctx, value);
      control.labelOf = (v) => labelAmong(ctx.children(), v);
      receive(control, value);
    } else {
      render(control);
    }
  },
  destroy: stopControl,
});
