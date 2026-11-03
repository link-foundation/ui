/**
 * `bindMachine(root, service, parts)`: connect a running machine to DOM
 * elements. Every part of the machine gets its `(attr ...)` values (kept
 * in sync with the state and context), its `(key KEY EVENT)` bindings and
 * its `(on EVENT SEND)` UI events, and the `focus` action of the machine
 * focuses a part element.
 */

import { diagnostic } from '../behavior/diagnostics.js';
import { firesInField, isTextField, keyOf, normalizeKey } from './keys.js';

/** UI events of a part → DOM events (as in ui-dom). */
const DOM_EVENTS = {
  press: 'click',
  focus: 'focusin',
  blur: 'focusout',
  hover: 'pointerenter',
};

/**
 * The part elements: the `parts` given, else `[data-part="NAME"]` in the
 * root; the part `root` (and any part without an element when `parts` is
 * not given) is the root itself.
 */
function resolveParts(root, service, parts) {
  const resolved = {};
  for (const name of Object.keys(service.machine.parts)) {
    const given = typeof parts === 'function' ? parts(name) : parts?.[name];
    resolved[name] =
      given ??
      (name === 'root'
        ? root
        : root.querySelector(`[data-part="${CSS_ESCAPE(name)}"]`));
  }
  return resolved;
}

/** Escape a part name for an attribute selector (names are LiNo atoms). */
const CSS_ESCAPE = (name) => String(name).replace(/["\\]/g, '\\$&');

/**
 * Set attributes to the current values, and remove the ones that are gone.
 * @param {HTMLElement} element
 * @param {Record<string, string>} attrs
 * @param {Set<string>} owned  the attributes set before
 */
function applyAttrs(element, attrs, owned) {
  for (const name of owned) {
    if (!Object.hasOwn(attrs, name)) {
      element.removeAttribute(name);
      owned.delete(name);
    }
  }
  for (const [name, value] of Object.entries(attrs)) {
    if (name.toLowerCase().startsWith('on')) {
      continue; // an on* attribute would run its value as code
    }
    if (element.getAttribute(name) !== value) {
      element.setAttribute(name, value);
    }
    owned.add(name);
  }
}

/**
 * @param {HTMLElement} root  the element of the component
 * @param {import('../behavior/interpret.js').Service} service
 * @param {Record<string, HTMLElement|null|undefined> |
 *   ((part: string) => HTMLElement|null|undefined)} [parts]  the part
 *   elements by name (default: `[data-part]` in the root)
 * @param {{onDiagnostic?: (d: object) => void, ignoreInFields?: boolean}}
 *   [options]
 * @returns {() => void} unbind: removes the listeners and the effects
 *   (the attributes stay as they are)
 */
export function bindMachine(root, service, parts, options = {}) {
  const { ignoreInFields = true } = options;
  const elements = resolveParts(root, service, parts);
  const cleanups = [];
  const owned = new Map();

  for (const [name, spec] of Object.entries(service.machine.parts)) {
    const element = elements[name];
    if (!element) {
      options.onDiagnostic?.(
        diagnostic('unknown-part', 'warning', {
          machine: service.machine.id,
          part: name,
        })
      );
      continue;
    }
    owned.set(name, new Set());
    if (!element.hasAttribute('data-part')) {
      element.setAttribute('data-part', name);
    }

    const keys = new Map(
      spec.keys.map(({ key, event }) => [normalizeKey(key), event])
    );
    if (keys.size > 0) {
      const onKey = (event) => {
        const combo = keyOf(event);
        if (!keys.has(combo) || event.defaultPrevented || event.isComposing) {
          return;
        }
        if (
          ignoreInFields &&
          isTextField(event.target) &&
          !firesInField(combo)
        ) {
          return;
        }
        // The machine handles the key: a native button must not also
        // turn it into a click (Enter on keydown, Space on keyup).
        event.preventDefault();
        if (event.type === 'keydown') {
          service.send({ type: keys.get(combo), key: combo, part: name });
        }
      };
      element.addEventListener('keydown', onKey);
      element.addEventListener('keyup', onKey);
      cleanups.push(() => {
        element.removeEventListener('keydown', onKey);
        element.removeEventListener('keyup', onKey);
      });
    }

    for (const { event, send } of spec.events) {
      const type = DOM_EVENTS[event] ?? event;
      const listener = () => service.send({ type: send, part: name });
      element.addEventListener(type, listener);
      cleanups.push(() => element.removeEventListener(type, listener));
    }
  }

  const sync = () => {
    for (const [name, attrs] of owned) {
      applyAttrs(elements[name], service.attrs(name), attrs);
    }
  };
  sync();
  cleanups.push(service.subscribe(sync));

  cleanups.push(
    service.use({
      focus(target) {
        const element = elements[target] ?? null;
        if (!element) {
          options.onDiagnostic?.(
            diagnostic('unknown-part', 'warning', {
              machine: service.machine.id,
              part: target,
            })
          );
          return false;
        }
        // Make the part focusable by script without adding it to the Tab
        // order (content regions, dialogs).
        if (element.tabIndex < 0 && !element.hasAttribute('tabindex')) {
          element.setAttribute('tabindex', '-1');
        }
        // Apply the attributes first: a part hidden a moment ago cannot
        // take focus.
        sync();
        element.focus();
        return true;
      },
    })
  );

  let bound = true;
  return () => {
    if (!bound) {
      return;
    }
    bound = false;
    for (const cleanup of cleanups.reverse()) {
      cleanup();
    }
  };
}
