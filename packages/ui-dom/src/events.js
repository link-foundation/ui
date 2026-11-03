/**
 * Behaviour (docs/spec/behaviour.md): `(on EVENT ACTION...)` handlers. An
 * action is data: the renderer never evaluates it and never writes an
 * `on*` attribute. When the event happens on the element, the renderer
 * dispatches one `ui-action` CustomEvent per action from the element
 * (bubbling, composed) and calls the `onAction` render option; the host
 * decides what `(navigate home)` does.
 */

import { isUnsafeUrl } from './diagnostics.js';
import { vocabulary } from './model.js';

/** UI events → the DOM events that trigger them. */
export const DOM_EVENTS = Object.freeze({
  press: 'click',
  focus: 'focusin',
  blur: 'focusout',
  hover: 'pointerenter',
  select: 'ui-select',
  activate: 'ui-activate',
});

/** Whether a name is a vocabulary action (`navigate`, `emit`...). */
const isVocabularyAction = (name) => vocabulary().actions.has(name);

/** A frozen deep copy of an action link (the event detail is data). */
function freeze(value) {
  return Array.isArray(value) ? Object.freeze(value.map(freeze)) : value;
}

/**
 * The valid handlers of an element; problems are reported and the
 * offending action (or handler) is left out.
 * @param {import('./model.js').Element} element
 * @param {(code: string, severity: string, at?: object) => void} report
 * @param {(name: string) => boolean} [isAction]  which action names are
 *   known; defaults to the vocabulary actions (a host with an actions
 *   registry passes its own check)
 * @returns {{event: string, domEvent: string, actions: readonly any[]}[]}
 */
export function handlersOf(element, report, isAction = isVocabularyAction) {
  const handlers = [];
  for (const property of element.properties) {
    if (property.name !== 'on') {
      continue;
    }
    const [event, ...links] = property.values;
    if (typeof event !== 'string' || links.length === 0) {
      report('invalid-handler', 'error', { property: 'on' });
      continue;
    }
    const domEvent = Object.hasOwn(DOM_EVENTS, event)
      ? DOM_EVENTS[event]
      : undefined;
    if (domEvent === undefined) {
      report('unknown-event', 'warning', { property: 'on', event });
      continue;
    }
    const actions = [];
    for (const link of links) {
      if (!Array.isArray(link) || typeof link[0] !== 'string') {
        report('invalid-handler', 'error', { property: 'on' });
      } else if (!isAction(link[0])) {
        report('unknown-action', 'warning', {
          property: 'on',
          action: link[0],
        });
      } else if (link[0] === 'navigate' && isUnsafeUrl(link[1])) {
        report('unsafe-url', 'error', { property: 'on' });
      } else {
        actions.push(freeze(link));
      }
    }
    if (actions.length > 0) {
      handlers.push({ event, domEvent, actions: Object.freeze(actions) });
    }
  }
  return handlers;
}

/**
 * Listen for the handlers of an element.
 * @param {HTMLElement} node  the element `ui-action` is dispatched from
 * @param {EventTarget} target  the element the DOM events come from
 * @param {ReturnType<typeof handlersOf>} handlers
 * @param {{idFor: (node: Node) => string|null,
 *   onAction?: (detail: object, event: Event) => void,
 *   diagnostic?: Function}} host
 * @returns {() => void} remove the listeners
 */
export function bindHandlers(node, target, handlers, host) {
  const win = node.ownerDocument.defaultView;
  const listeners = handlers.map(({ event, domEvent, actions }) => {
    const listener = (domEventObject) => {
      for (const action of actions) {
        const resolved = resolveItemAction(action, domEventObject.detail?.item);
        if (resolved[0] === 'navigate' && isUnsafeUrl(resolved[1])) {
          host.diagnostic?.('unsafe-url', 'error', { property: 'on' });
          continue;
        }
        // The ID at dispatch time: a rename after binding is honoured.
        const detail = Object.freeze({
          source: host.idFor(node),
          event,
          action: resolved,
        });
        node.dispatchEvent(
          new win.CustomEvent('ui-action', {
            bubbles: true,
            composed: true,
            detail,
          })
        );
        host.onAction?.(detail, domEventObject);
      }
    };
    target.addEventListener(domEvent, listener);
    return [domEvent, listener];
  });
  return () => {
    for (const [domEvent, listener] of listeners) {
      target.removeEventListener(domEvent, listener);
    }
  };
}

/** Resolve item references from data-kind events by own-property traversal only. */
function resolveItemAction(action, item) {
  if (item === undefined) {
    return action;
  }
  const resolve = (value) => {
    const reference =
      Array.isArray(value) &&
      value[0] === 'param' &&
      typeof value[1] === 'string' &&
      value[1].startsWith('item.')
        ? value[1].slice(5)
        : null;
    if (Array.isArray(value) && reference === null) {
      return Object.freeze(value.map(resolve));
    }
    if (reference === null) {
      return value;
    }
    let current = item;
    for (const name of reference.split('.')) {
      if (
        ['__proto__', 'prototype', 'constructor'].includes(name) ||
        current === null ||
        typeof current !== 'object' ||
        !Object.hasOwn(current, name)
      ) {
        return undefined;
      }
      current = current[name];
    }
    return current;
  };
  return resolve(action);
}
