/**
 * @link-foundation/ui-devmode: the development/configuration mode of the
 * framework, a runtime inspector over any page rendered by ui-dom.
 *
 * This entry module is small on purpose: it reads the site policy and
 * installs the entry points (shortcut, `?ui-dev`, `<ui-dev-mode>`). The
 * overlay, the inspector and the model are loaded with a dynamic `import()`
 * only when dev mode opens; with `(enabled false)` they are never requested.
 */

import { installActivation } from './activation.js';
import { translator } from './messages.js';
import { defaultPolicy, parseDevModePolicy } from './policy.js';

export {
  ELEMENT_NAME,
  installActivation,
  isEditableTarget,
  matchesShortcut,
  parseShortcut,
  REQUEST_EVENT,
  shouldActivate,
  URL_PARAMETER,
} from './activation.js';
export { MESSAGES, message, translator } from './messages.js';
export {
  DEFAULT_SHORTCUT,
  defaultPolicy,
  ENTRY_POINTS,
  parseDevModePolicy,
  POLICY_KIND,
  WRITABLE_LAYERS,
} from './policy.js';

/** The name of the global handle of an open dev mode. */
export const GLOBAL_NAME = 'linkUiDevMode';

/**
 * The policy of `mountDevMode`: a policy object, Links Notation text, a
 * ui-core document or nodes; the defaults without one.
 */
function readPolicy(policy) {
  if (policy === undefined || policy === null) {
    return defaultPolicy();
  }
  if (typeof policy === 'object' && policy.entry instanceof Set) {
    return policy;
  }
  return parseDevModePolicy(policy);
}

/**
 * Mount dev mode over a page rendered by ui-dom.
 *
 * Open, it highlights the element under the pointer (`id: type`), selects
 * it on click without delivering the click to the app, and shows the
 * inspector docked to the right: Outline, Properties (typed editors that
 * write the session layer), Styles, Tokens, Animations and Source. While it
 * is open, `globalThis.linkUiDevMode` is `{ select, getSelection,
 * setProperty, close }`.
 *
 * @param {{ root: Element, config: object,
 *   policy?: string|object|import('./policy.js').DevModePolicy,
 *   store?: object, handle?: { nodeFor?: (id: string) => Element|null },
 *   styles?: string|object[], tokens?: string|Map<string, object>,
 *   theme?: string, animations?: string|object[], vocabulary?: object,
 *   messages?: Record<string, string>, layout?: string,
 *   window?: Window & typeof globalThis,
 *   onOpen?: () => void, onClose?: () => void }} options
 *   `root` is the container ui-dom rendered into, `config` the ui-config
 *   configuration of the page (bound to its store), `store` and `handle`
 *   what `mountDocument` returned
 * @returns {{ policy: import('./policy.js').DevModePolicy,
 *   readonly isOpen: boolean, open: () => Promise<boolean>,
 *   close: () => void, toggle: () => Promise<boolean>,
 *   select: (id: string|null) => Promise<string|null>,
 *   destroy: () => void }}
 */
export function mountDevMode(options) {
  const { root, config } = options;
  const policy = readPolicy(options.policy);
  const window = options.window ?? root.ownerDocument.defaultView;
  const t = translator(options.messages);
  let session = null;
  let opening = null;
  let destroyed = false;

  const publish = (value) => {
    if (value) {
      globalThis[GLOBAL_NAME] = Object.freeze({
        select: (id) => value.select(id),
        getSelection: () => value.getSelection(),
        setProperty: (id, name, propertyValue) =>
          value.setProperty(id, name, propertyValue),
        close: () => controller.close(),
      });
    } else if (globalThis[GLOBAL_NAME]?.close) {
      delete globalThis[GLOBAL_NAME];
    }
  };

  const start = async () => {
    const { openSession } = await import('./session.js');
    if (destroyed) {
      return null;
    }
    return openSession({
      ...options,
      window,
      root,
      config,
      policy,
      t,
      onClose() {
        session = null;
        publish(null);
        options.onClose?.();
      },
    });
  };

  const controller = {
    policy,
    get isOpen() {
      return session !== null;
    },
    /** Open dev mode (loads the inspector the first time). */
    async open() {
      if (!policy.enabled || destroyed) {
        return false;
      }
      if (session) {
        return true;
      }
      if (opening === null) {
        const ticket = start().then((value) => {
          if (opening !== ticket) {
            // Closed (or destroyed) while the inspector was loading.
            value?.close();
            return null;
          }
          opening = null;
          session = value;
          if (value) {
            publish(value);
            options.onOpen?.();
          }
          return value;
        });
        opening = ticket;
      }
      return (await opening) !== null;
    },
    /** Close dev mode; the session and user layers stay as they are. */
    close() {
      opening = null;
      session?.close();
    },
    /** Close dev mode when it is open, else open it. */
    toggle() {
      if (session || opening) {
        controller.close();
        return Promise.resolve(false);
      }
      return controller.open();
    },
    /** Open dev mode and select an element (`null` clears the selection). */
    async select(id) {
      return (await controller.open()) ? session.select(id) : null;
    },
    /** Close dev mode and remove its entry points. */
    destroy() {
      controller.close();
      destroyed = true;
      uninstall();
    },
  };

  const uninstall = installActivation({
    window,
    policy,
    onActivate: () => {
      controller.open();
    },
    onToggle: () => {
      controller.toggle();
    },
  });
  return controller;
}
