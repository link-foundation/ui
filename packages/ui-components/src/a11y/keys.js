/**
 * Key bindings: `bindKeys(element, { Enter: open, 'Shift+Tab': back })`.
 * A key combination is written as the modifiers `Ctrl`, `Alt`, `Shift`,
 * `Meta` (in that order) and the `KeyboardEvent.key`, joined by `+`; the
 * space bar is `Space`. Shift is part of the character for printable keys
 * (`?`, `A`), so it is not written for them.
 */

const MODIFIERS = [
  ['ctrlKey', 'Ctrl'],
  ['altKey', 'Alt'],
  ['shiftKey', 'Shift'],
  ['metaKey', 'Meta'],
];

/** Whether a key is a printable character (one code point, not a space). */
/** Modifier names as written (lower case) → their canonical names. */
const MODIFIER_ALIASES = {
  ctrl: 'Ctrl',
  control: 'Ctrl',
  alt: 'Alt',
  option: 'Alt',
  shift: 'Shift',
  meta: 'Meta',
  cmd: 'Meta',
  command: 'Meta',
};

/** Key names as written (lower case) → `KeyboardEvent.key` names. */
const KEY_ALIASES = {
  space: 'Space',
  spacebar: 'Space',
  esc: 'Escape',
  escape: 'Escape',
  enter: 'Enter',
  return: 'Enter',
  tab: 'Tab',
};

const isCharacter = (key) => [...key].length === 1 && key !== ' ';

/**
 * The combination of a keyboard event: `Enter`, `Space`, `Shift+Tab`,
 * `Ctrl+k`, `a`, `?`.
 * @param {{key: string, ctrlKey?: boolean, altKey?: boolean,
 *   shiftKey?: boolean, metaKey?: boolean}} event
 */
export function keyOf(event) {
  const key = event.key === ' ' ? 'Space' : event.key;
  const parts = MODIFIERS.filter(
    ([flag, name]) => event[flag] && !(name === 'Shift' && isCharacter(key))
  ).map(([, name]) => name);
  return [...parts, key].join('+');
}

/**
 * A key combination written by hand in its canonical form: modifier order,
 * `Control` → `Ctrl`, `Cmd` → `Meta`, `space` and `' '` → `Space`, `esc` →
 * `Escape` (modifier and key names in any case).
 * @param {string} combo
 */
export function normalizeKey(combo) {
  if (combo === ' ' || combo === '+') {
    return combo === ' ' ? 'Space' : '+';
  }
  const names = combo.split('+');
  const key = names.pop();
  const flags = new Set(
    names.map((name) => MODIFIER_ALIASES[name.toLowerCase()] ?? name)
  );
  return keyOf({
    key: key === '' ? '+' : (KEY_ALIASES[key.toLowerCase()] ?? key),
    ctrlKey: flags.has('Ctrl'),
    altKey: flags.has('Alt'),
    shiftKey: flags.has('Shift'),
    metaKey: flags.has('Meta'),
  });
}

const TEXT_INPUTS = new Set([
  'text',
  'search',
  'email',
  'url',
  'tel',
  'password',
  'number',
  'date',
  'datetime-local',
  'month',
  'time',
  'week',
]);

/**
 * Whether an element takes typed text: a text-like `<input>`, a
 * `<textarea>`, a `<select>` or an editable element.
 * @param {EventTarget|null|undefined} element
 */
/**
 * Whether an element is editable content: `isContentEditable`, or (where
 * the DOM has no such property, as in jsdom) the closest `contenteditable`
 * attribute.
 */
function isEditable(element) {
  if (typeof element.isContentEditable === 'boolean') {
    return element.isContentEditable;
  }
  const value = element
    .closest?.('[contenteditable]')
    ?.getAttribute('contenteditable');
  return value !== undefined && value !== null && value !== 'false';
}

export function isTextField(element) {
  if (!element || element.nodeType !== 1) {
    return false;
  }
  const tag = element.localName;
  if (tag === 'input') {
    return TEXT_INPUTS.has(
      (element.getAttribute('type') ?? 'text').toLowerCase()
    );
  }
  return tag === 'textarea' || tag === 'select' || isEditable(element);
}

/** Keys a text field does not use for typing: they fire there too. */
const FIELD_SAFE = /^(Escape|F\d{1,2})$/;

/**
 * Whether a combination may fire while focus is in a text field: only
 * combinations with Ctrl, Alt or Meta, and Escape and the function keys.
 * A plain letter, Space, Enter or an arrow key belongs to the field.
 * @param {string} combo  a canonical combination (`keyOf`)
 */
export function firesInField(combo) {
  const names = combo === '+' ? ['+'] : combo.split('+');
  const key = names.at(-1) === '' ? '+' : names.at(-1);
  return (
    names.some(
      (name) => name === 'Ctrl' || name === 'Alt' || name === 'Meta'
    ) || FIELD_SAFE.test(key)
  );
}

/**
 * Listen for key combinations on an element (and its descendants, as
 * `keydown` bubbles). A handler that returns `false` leaves the event
 * alone; otherwise its default action is prevented.
 * @param {EventTarget} element
 * @param {Record<string, (event: KeyboardEvent) => unknown>} map  handlers
 *   by combination (`Enter`, `Shift+Tab`, `Ctrl+k`, `Space`)
 * @param {{ignoreInFields?: boolean, type?: 'keydown'|'keyup'}} [options]
 *   `ignoreInFields` (default `true`): in a text field only `firesInField`
 *   combinations fire, so typing never triggers a binding
 * @returns {() => void} unbind
 */
export function bindKeys(element, map, options = {}) {
  const { ignoreInFields = true, type = 'keydown' } = options;
  const handlers = new Map(
    Object.entries(map).map(([combo, fn]) => [normalizeKey(combo), fn])
  );
  const listener = (event) => {
    if (event.defaultPrevented || event.isComposing) {
      return;
    }
    const combo = keyOf(event);
    const handler = handlers.get(combo);
    if (handler === undefined) {
      return;
    }
    if (ignoreInFields && isTextField(event.target) && !firesInField(combo)) {
      return;
    }
    if (handler(event) !== false) {
      event.preventDefault();
    }
  };
  element.addEventListener(type, listener);
  return () => element.removeEventListener(type, listener);
}
