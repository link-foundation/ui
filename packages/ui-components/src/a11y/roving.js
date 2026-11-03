/**
 * A roving tabindex (WAI-ARIA APG): one item of a composite widget (a
 * toolbar, a tab list, a radio group, a menu) is in the Tab order with
 * `tabindex="0"`, the others have `tabindex="-1"`, and the arrow keys,
 * Home and End move focus between them.
 */

const NEXT = {
  horizontal: ['ArrowRight'],
  vertical: ['ArrowDown'],
  both: ['ArrowRight', 'ArrowDown'],
};
const PREVIOUS = {
  horizontal: ['ArrowLeft'],
  vertical: ['ArrowUp'],
  both: ['ArrowLeft', 'ArrowUp'],
};

/** Whether an item is skipped by the arrow keys. */
const isDisabled = (item) =>
  item.disabled === true ||
  item.getAttribute('aria-disabled') === 'true' ||
  item.hidden === true;

/**
 * @param {HTMLElement[] | (() => HTMLElement[])} items  the items, or a
 *   function that returns the current items (for lists that change)
 * @param {{orientation?: 'horizontal'|'vertical'|'both', loop?: boolean,
 *   initial?: number, rtl?: boolean,
 *   onChange?: (index: number, item: HTMLElement) => void}} [options]
 *   `orientation` (default `horizontal`), `loop` (default `true`): moving
 *   past the last item wraps to the first; `rtl` swaps Left and Right
 */
export function createRovingTabindex(items, options = {}) {
  const { orientation = 'horizontal', loop = true, rtl = false } = options;
  if (!Object.hasOwn(NEXT, orientation)) {
    throw new TypeError(
      `createRovingTabindex: unknown orientation ${JSON.stringify(orientation)}`
    );
  }
  const list = typeof items === 'function' ? items : () => items;
  let index = Math.max(0, options.initial ?? 0);
  const swap = (key) =>
    rtl
      ? ({ ArrowRight: 'ArrowLeft', ArrowLeft: 'ArrowRight' }[key] ?? key)
      : key;

  /** Give the current item tabindex 0 and the others -1. */
  const update = () => {
    const all = list();
    if (index >= all.length) {
      index = Math.max(0, all.length - 1);
    }
    if (all[index] && isDisabled(all[index])) {
      const first = all.findIndex((item) => !isDisabled(item));
      index = first === -1 ? index : first;
    }
    all.forEach((item, i) =>
      item.setAttribute('tabindex', i === index ? '0' : '-1')
    );
  };

  /** The next enabled index from `from` in `step` direction, or -1. */
  const seek = (from, step) => {
    const all = list();
    for (let n = 1; n <= all.length; n++) {
      let i = from + step * n;
      if (loop) {
        i = ((i % all.length) + all.length) % all.length;
      } else if (i < 0 || i >= all.length) {
        return -1;
      }
      if (!isDisabled(all[i])) {
        return i;
      }
    }
    return -1;
  };

  const focus = (next) => {
    const all = list();
    if (next < 0 || next >= all.length) {
      return false;
    }
    index = next;
    update();
    all[index].focus();
    options.onChange?.(index, all[index]);
    return true;
  };

  /** Handle a keydown; returns whether the key moved focus. */
  const handleKeyDown = (event) => {
    if (event.ctrlKey || event.altKey || event.metaKey) {
      return false;
    }
    const key = swap(event.key);
    const all = list();
    let next;
    if (NEXT[orientation].includes(key)) {
      next = seek(index, 1);
    } else if (PREVIOUS[orientation].includes(key)) {
      next = seek(index, -1);
    } else if (key === 'Home') {
      next = all.findIndex((item) => !isDisabled(item));
    } else if (key === 'End') {
      next = all.findLastIndex((item) => !isDisabled(item));
    } else {
      return false;
    }
    event.preventDefault?.();
    return next !== -1 && focus(next);
  };

  /** Follow focus that reaches an item another way (a click). */
  const onFocusIn = (event) => {
    const i = list().indexOf(event.target);
    if (i !== -1 && i !== index) {
      index = i;
      update();
      options.onChange?.(index, event.target);
    }
  };

  update();
  return {
    get index() {
      return index;
    },
    get item() {
      return list()[index] ?? null;
    },
    focus,
    update,
    handleKeyDown,
    /**
     * Listen on a container for keydown and focusin.
     * @param {HTMLElement} container
     * @returns {() => void} detach
     */
    attach(container) {
      const onKeyDown = (event) => {
        if (list().includes(event.target)) {
          handleKeyDown(event);
        }
      };
      container.addEventListener('keydown', onKeyDown);
      container.addEventListener('focusin', onFocusIn);
      return () => {
        container.removeEventListener('keydown', onKeyDown);
        container.removeEventListener('focusin', onFocusIn);
      };
    },
  };
}
