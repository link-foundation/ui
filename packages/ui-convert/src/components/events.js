/**
 * Event names of JSX (`onClick`) and Vue (`@click`) handlers as dialect
 * events: `click` is `press` (docs/spec/behaviour.md), the others keep their
 * name in kebab-case (`onMouseEnter` -> `mouse-enter`).
 */

const EVENTS = { click: 'press', 'double-click': 'double-press' };

const isUpper = (c) => c >= 'A' && c <= 'Z';

/**
 * The dialect event of a DOM event name (`click`, `mouseEnter`, `keydown`).
 * @param {string} name
 */
export function eventName(name) {
  let out = '';
  for (const c of name) {
    out += isUpper(c) && out !== '' ? `-${c.toLowerCase()}` : c.toLowerCase();
  }
  return EVENTS[out] ?? out;
}

/**
 * The event of a JSX handler prop (`onClick` -> `press`), or `null` when the
 * prop is not a handler (`on`, `one`, `onion`).
 * @param {string} prop
 */
export const jsxEvent = (prop) =>
  prop.length > 2 && prop.startsWith('on') && isUpper(prop[2])
    ? eventName(prop.slice(2))
    : null;
