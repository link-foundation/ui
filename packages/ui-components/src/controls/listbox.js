/**
 * The popup list of `select` and `combobox`: a `listbox` of `option`
 * children, its active option (`aria-activedescendant` of the input, the
 * focus stays in the input) and the actions both machines share.
 */

import { createTypeahead } from '../a11y/typeahead.js';
import { watchChildren } from '../layout/dom.js';
import { choiceLabel, choiceValue } from './choices.js';
import { setAttr } from './dom.js';

/** Every option node of a listbox. */
export const optionsOf = (listbox) =>
  [...listbox.children].filter((n) => n.localName === 'ui-option');

/** Whether an option can be activated (shown, enabled). */
const isAvailable = (option) =>
  !option.hasAttribute('hidden') && !option.hasAttribute('disabled');

/** The options the keys move through. */
export const availableOf = (listbox) => optionsOf(listbox).filter(isAvailable);

/** The value and the label of an option node. */
export const optionValue = (option) => option.getAttribute('data-value');
export const optionLabel = (option) => option.textContent.trim();

/** The option of a value, or `null`. */
export const optionFor = (listbox, value) =>
  value === null || value === undefined
    ? null
    : (optionsOf(listbox).find((o) => optionValue(o) === value) ?? null);

/**
 * The listbox actions: `(activate WHICH)` with WHICH one of `selected`,
 * `none`, `first`, `last`, `next`, `previous`; `select-active`,
 * `select-picked` (the option clicked) and `typeahead` (the key typed).
 * @param {{listbox: HTMLElement, picked: HTMLElement|null,
 *   typed: string|null, typeahead: object}} list
 */
export function listboxActions(list) {
  const pick = (option, meta) => {
    if (option && isAvailable(option)) {
      meta.assign({ value: optionValue(option) });
    }
  };
  const activeOf = (meta) =>
    availableOf(list.listbox).find((o) => o.id === meta.context.active) ?? null;
  return {
    activate: ([which], meta) => {
      const options = availableOf(list.listbox);
      const current = options.indexOf(activeOf(meta));
      const target = {
        selected: () =>
          options.find((o) => optionValue(o) === meta.context.value) ??
          options[0],
        none: () => null,
        first: () => options[0],
        last: () => options.at(-1),
        next: () =>
          options[
            current === -1 ? 0 : Math.min(current + 1, options.length - 1)
          ],
        previous: () =>
          options[
            current === -1 ? options.length - 1 : Math.max(current - 1, 0)
          ],
      }[which]?.();
      meta.assign({ active: target?.id ?? null });
    },
    'select-active': (args, meta) => pick(activeOf(meta), meta),
    'select-picked': (args, meta) => pick(list.picked, meta),
    typeahead: (args, meta) => {
      const options = availableOf(list.listbox);
      const current = options.indexOf(activeOf(meta));
      const index = list.typeahead.handleKey(list.typed ?? '', current);
      if (index !== -1) {
        meta.assign({ active: options[index].id });
      }
    },
  };
}

/** A listbox state: the clicked option and the typed key of an event. */
export function createListState(listbox) {
  const list = { listbox, picked: null, typed: null };
  list.typeahead = createTypeahead(() => availableOf(listbox).map(optionLabel));
  return list;
}

/** Mark the selected and the active options; keep the active one in view. */
export function renderOptions(listbox, { value, active }) {
  for (const option of optionsOf(listbox)) {
    setAttr(option, 'aria-selected', String(optionValue(option) === value));
    const on = option.id === active;
    if (on !== option.hasAttribute('data-active')) {
      option.toggleAttribute('data-active', on);
      if (on) {
        option.scrollIntoView?.({ block: 'nearest' });
      }
    }
  }
}

/**
 * Connect a listbox to its control: a click on an option picks it (sent
 * as `pick`), a mousedown keeps the focus in the input, and option changes
 * re-render the control.
 * @returns {() => void} disconnect
 */
export function connectListbox(list, control, refresh) {
  const { listbox } = list;
  const onClick = (event) => {
    list.picked = event.target.closest?.('ui-option') ?? null;
  };
  const keepFocus = (event) => event.preventDefault();
  listbox.addEventListener('click', onClick, true);
  listbox.addEventListener('mousedown', keepFocus);
  const observer = watchChildren(listbox, refresh, [
    'data-value',
    'disabled',
    'data-label',
  ]);
  return () => {
    listbox.removeEventListener('click', onClick, true);
    listbox.removeEventListener('mousedown', keepFocus);
    observer.disconnect();
  };
}

/** The label of a value among the child elements (static rendering). */
export function labelAmong(children, value) {
  const child = children.find((c) => choiceValue(c) === value);
  return child === undefined ? null : choiceLabel(child);
}
