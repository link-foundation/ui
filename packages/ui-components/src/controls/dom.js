/**
 * Helpers shared by the control kinds: property readers, part elements
 * (`data-part` with the Open UI part names), the machine of a control and
 * the `ui-change` event a control dispatches once per committed value.
 *
 * A control runs its machine (`machines/<kind>.lino`) with
 * `interpret` and binds it to its parts with `bindMachine`. Element
 * properties reach the machine through `control.assign`, and a value the
 * user commits leaves through `control.commit`: a bubbling `ui-change`
 * event whose detail `{source, property, value}` `mountControls` writes to
 * the store in one `setProp` before the `(on change ...)` handlers run.
 *
 * In the static document of ui-dom `renderToHTML` (no window) and when the
 * element names its own `(machine ...)` (run by `mountBehavior`), the
 * machine only writes the attributes of its parts; it listens to nothing.
 */

import { bindMachine } from '../a11y/bind-machine.js';
import { interpret } from '../behavior/interpret.js';
import { createMachine } from '../behavior/parse-machine.js';
import { atomOf, flagOf, isLive, numberOf, setText } from '../layout/dom.js';
import { CONTROL_MACHINES } from './machines/index.js';

export { atomOf, flagOf, isLive, numberOf, setText };

/** The prefix of the DOM ids of control parts. */
export const ID_PREFIX = 'ui-control';

/** The DOM id of a part of the control of a store element. */
export const partId = (id, part = 'input') => `${ID_PREFIX}-${id}-${part}`;

/** The guards of the control machines (besides `not-disabled`). */
export const CONTROL_GUARDS = Object.freeze({
  editable: (context) => context.disabled !== true && context.readonly !== true,
});

const parsed = new Map();

/** The parsed machine of a control kind (read once). */
export function controlMachine(kind) {
  if (!parsed.has(kind)) {
    parsed.set(kind, createMachine(CONTROL_MACHINES[kind]));
  }
  return parsed.get(kind);
}

/**
 * Create a part element: `<tag data-part="name" ...attrs>`.
 * @param {Document} document
 * @param {string} tag
 * @param {string|null} name  the part name (`null`: no part)
 * @param {Record<string, string>} [attrs]
 */
export function partOf(document, tag, name, attrs = {}) {
  const node = document.createElement(tag);
  if (name !== null) {
    node.setAttribute('data-part', name);
  }
  for (const [key, value] of Object.entries(attrs)) {
    node.setAttribute(key, value);
  }
  return node;
}

/** Set an attribute, or remove it when the value is `undefined`/`null`. */
export function setAttr(node, name, value) {
  if (value === undefined || value === null) {
    node.removeAttribute(name);
  } else if (node.getAttribute(name) !== String(value)) {
    node.setAttribute(name, String(value));
  }
}

/** Mirror boolean properties to boolean attributes of a native element. */
export function syncFlags(node, el, names) {
  for (const name of names) {
    node.toggleAttribute(name, flagOf(el, name));
  }
}

/**
 * The visible label of a control: `<label data-part="label" for=...>`.
 * An empty label is hidden and reported (`missing-label`) once.
 */
export function updateLabel(label, el, ctx, property = 'label') {
  const text = atomOf(el, property);
  setText(label, text);
  const empty = text === undefined || text === '';
  label.toggleAttribute('hidden', empty);
  if (empty) {
    ctx.diagnostic('missing-label', 'warning', { property });
  }
}

/**
 * Write the machine attributes of every part (static rendering); `owned`
 * remembers them, so an attribute that is gone is removed.
 */
function writeAttrs(service, parts, owned) {
  for (const name of Object.keys(service.machine.parts)) {
    const node = parts[name];
    if (node) {
      node.setAttribute('data-part', name);
      const attrs = service.attrs(name);
      for (const attr of owned.get(name) ?? []) {
        if (!Object.hasOwn(attrs, attr)) {
          node.removeAttribute(attr);
        }
      }
      for (const [attr, value] of Object.entries(attrs)) {
        setAttr(node, attr, value);
      }
      owned.set(name, Object.keys(attrs));
    }
  }
}

const controls = new WeakMap();

/**
 * Start the control of a node.
 * @param {HTMLElement} node  the kind's node
 * @param {object} el  the element model
 * @param {object} ctx  the kind context
 * @param {object} options
 * @param {string} [options.kind]  the control kind (its own machine)
 * @param {object} [options.machine]  a parsed shared machine instead
 * @param {Record<string, HTMLElement>} options.parts  part elements
 * @param {HTMLElement} options.target  where `ui-change` is dispatched
 *   (the kind's event target)
 * @param {Record<string, Function>} [options.actions]  machine actions
 * @param {Record<string, unknown>} [options.context]  the initial context
 * @param {boolean} [options.ignoreInFields]  passed to `bindMachine`
 * @param {(control: object) => void} [options.render]  called after every
 *   machine change
 */
export function startControl(node, el, ctx, options) {
  const report = (d) => ctx.diagnostic(d.code, d.severity, d.at);
  const service = interpret(options.machine ?? controlMachine(options.kind), {
    actions: options.actions,
    guards: CONTROL_GUARDS,
    context: options.context,
    onDiagnostic: report,
  });
  const control = {
    node,
    service,
    parts: options.parts,
    value: undefined,
    assign: (patch) => service.assign(patch),
    commit(property, value) {
      const win = ctx.document.defaultView;
      if (!win) {
        return;
      }
      options.target.dispatchEvent(
        new win.CustomEvent('ui-change', {
          bubbles: true,
          composed: true,
          detail: Object.freeze({
            source: node.getAttribute('data-link-id'),
            property,
            value,
          }),
        })
      );
    },
    unbind: () => {},
  };
  const live = isLive(ctx) && !el.props.has('machine');
  const owned = new Map();
  if (live) {
    control.unbind = bindMachine(node, service, options.parts, {
      onDiagnostic: report,
      ignoreInFields: options.ignoreInFields ?? true,
    });
  } else {
    writeAttrs(service, options.parts, owned);
  }
  const unsubscribe = service.subscribe(() => {
    if (!live) {
      writeAttrs(service, options.parts, owned);
    }
    options.render?.(control);
  });
  control.stop = () => {
    unsubscribe();
    control.unbind();
    service.stop();
  };
  controls.set(node, control);
  return control;
}

/** The control of a node (`undefined` before `create`). */
export const controlOf = (node) => controls.get(node);

/** Stop the control of a node (the kind's `destroy`). */
export function stopControl(node) {
  controls.get(node)?.stop();
  controls.delete(node);
}

/**
 * Update the value a control holds from its element property: the value
 * is remembered first, so the machine change it causes is not committed
 * back to the store.
 */
export function receive(control, value, patch = {}) {
  control.value = value;
  control.assign({ value, ...patch });
}

/**
 * Commit the context value of a control when the user changed it: one
 * `ui-change` per new value.
 */
export function commitValue(
  control,
  property = 'value',
  value = control.service.context.value
) {
  if (value !== control.value) {
    control.value = value;
    control.commit(property, value);
  }
}

/**
 * Bring the machine of a control to a value its element property holds:
 * nothing is committed back, and `disabled` (which only stops the user)
 * does not stop the host.
 */
export function driveControl(control, event, value, disabled) {
  control.driven = true;
  control.assign({ disabled: false });
  control.service.send(event);
  control.assign({ disabled });
  control.value = value;
  control.driven = false;
}

/** The text of a property, `fallback` when it is missing. */
export const textOf = (el, name, fallback = '') => atomOf(el, name) ?? fallback;

/** The number of a property, or `null` when it is missing or not a number. */
export const maybeNumber = (el, name) => numberOf(el, name, null);

const updated = new WeakSet();

/**
 * Whether an update touches a property: every property on the first
 * update of a node (ui-dom passes only the properties an element has, and
 * a missing one still needs its default), then the changed ones.
 * @returns {(name: string) => boolean}
 */
export function changesOf(node, changed) {
  const first = !updated.has(node);
  updated.add(node);
  return (name) => first || changed.includes(name);
}
