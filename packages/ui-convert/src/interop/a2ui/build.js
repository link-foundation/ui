/**
 * A2UI client state -> ui-dialect element tree.
 *
 * Every surface is a `document`. Its flat component list is nested: a
 * component becomes a child of the first component that names it in a
 * child slot, walking from the `root` component, then from the components
 * no other component names, then from the rest. A slot that the nesting
 * cannot express exactly (a missing or shared child, a cycle) is kept as
 * raw ids in `(extra a2ui ...)`, so the flat list always comes back.
 *
 * Component ids are kept as element ids when they are free; a component
 * whose id is taken (by another surface) gets a fresh id and `(ref <id>)`.
 */

import { isDeepStrictEqual } from 'node:util';
import { encodeAny, extraProperty } from '../extra.js';
import { IdAllocator, element, prop } from '../lino.js';
import { isObject } from '../safety.js';
import {
  DEFAULT_MESSAGE_VERSION,
  FORMAT,
  INPUT_TYPES,
  SLOT_KEYS,
  encodeDynamic,
  isBinding,
  mapping,
} from './shared.js';

const isIdChar = (c) =>
  (c >= 'a' && c <= 'z') ||
  (c >= 'A' && c <= 'Z') ||
  (c >= '0' && c <= '9') ||
  c === '-' ||
  c === '_' ||
  c === '.';

/** Whether an A2UI id can be an element id as it is. */
const isPlainId = (id) => id !== '' && [...id].every(isIdChar);

/** The stack kind properties of the layout types. */
const LAYOUT = {
  Row: ['direction', 'horizontal'],
  Column: ['direction', 'vertical'],
  List: ['role', 'list'],
  Card: ['role', 'card'],
  Modal: ['role', 'modal'],
};

/**
 * The component ids a component names in its slots, in order.
 * @param {Record<string, unknown>} component
 * @returns {string[]}
 */
export function slotIds(component) {
  const keys = SLOT_KEYS[component.component] ?? [];
  const ids = [];
  for (const key of keys) {
    const slot = component[key];
    if (key === 'tabs' && Array.isArray(slot)) {
      ids.push(...slot.map((tab) => (isObject(tab) ? tab.child : undefined)));
    } else if (key === 'children' && isObject(slot)) {
      ids.push(slot.componentId);
    } else if (Array.isArray(slot)) {
      ids.push(...slot);
    } else {
      ids.push(slot);
    }
  }
  return ids.filter((id) => typeof id === 'string');
}

/**
 * The nesting of a surface: who owns each component and the components in
 * the pre-order of the nested tree.
 * @param {import('./state.js').Surface} surface
 */
export function nesting(surface) {
  const { components } = surface;
  const owner = new Map();
  const order = [];
  const visit = (id, parent) => {
    if (owner.has(id) || !components.has(id)) {
      return;
    }
    owner.set(id, parent);
    order.push(id);
    for (const child of slotIds(components.get(id))) {
      visit(child, id);
    }
  };
  const named = new Set([...components.values()].flatMap(slotIds));
  visit('root', null);
  for (const id of components.keys()) {
    if (!named.has(id)) {
      visit(id, null);
    }
  }
  for (const id of components.keys()) {
    visit(id, null);
  }
  return { owner, order };
}

/**
 * The slots of a component rebuilt from the ids of its nested children and
 * the `(tab ...)` titles and `(repeat ...)` path of its element. Only keys
 * with something to hold are written.
 * @param {string} type
 * @param {string[]} ids
 * @param {{ titles?: unknown[], repeat?: string }} parts
 */
export function rebuildSlots(type, ids, parts) {
  const out = {};
  const keys = SLOT_KEYS[type] ?? [];
  if (keys.includes('children') && parts.repeat !== undefined) {
    if (ids.length === 1) {
      out.children = { componentId: ids[0], path: parts.repeat };
    }
  } else if (keys.includes('children') && ids.length > 0) {
    out.children = ids;
  } else if (keys.includes('child') && ids.length === 1) {
    out.child = ids[0];
  } else if (keys.includes('trigger') && ids.length === 2) {
    [out.trigger, out.content] = ids;
  } else if (
    keys.includes('tabs') &&
    ids.length > 0 &&
    parts.titles?.length === ids.length
  ) {
    out.tabs = ids.map((child, i) => ({ title: parts.titles[i], child }));
  }
  return out;
}

/** The `(tab ...)` titles and template path a component's slots need. */
function slotParts(component) {
  const parts = {};
  const { children, tabs } = component;
  if (
    isObject(children) &&
    Object.keys(children).length === 2 &&
    typeof children.componentId === 'string' &&
    typeof children.path === 'string'
  ) {
    parts.repeat = children.path;
  }
  if (Array.isArray(tabs) && tabs.every(isObject)) {
    parts.titles = tabs.map((tab) => tab.title);
  }
  return parts;
}

/**
 * Builds the element tree of a state.
 */
export class TreeBuilder {
  /** @param {import('../../diagnostics.js').Diagnostics|null} diagnostics */
  constructor(diagnostics) {
    this.diagnostics = diagnostics;
    this.ids = new IdAllocator();
  }

  /** @param {import('./state.js').State} state */
  build(state) {
    return [...state.surfaces.values()].map((s) => this.surface(s));
  }

  /** An element id for an A2UI id, and the `(ref ...)` it needs. */
  claim(id, base) {
    const claimed = isPlainId(id) ? this.ids.claim(id) : null;
    const elementId = claimed ?? this.ids.fresh(base);
    return { elementId, ref: claimed ? null : prop('ref', encodeAny(id)) };
  }

  surface(surface) {
    const { elementId, ref } = this.claim(surface.id, 'surface');
    const { catalogId, sendDataModel, ...rest } = surface.create;
    delete rest.surfaceId;
    const { owner, order } = nesting(surface);
    this.surfaceElement = elementId;
    this.surfaceState = surface;
    this.owner = owner;
    const roots = order.filter((id) => owner.get(id) === null);
    return element(elementId, 'document', {
      properties: [
        prop('source', FORMAT, surface.version ?? DEFAULT_MESSAGE_VERSION),
        ref,
        catalogId === undefined ? null : prop('catalog', encodeAny(catalogId)),
        sendDataModel === undefined
          ? null
          : prop('send-data-model', encodeAny(sendDataModel)),
        surface.model === undefined
          ? null
          : prop('model', JSON.stringify(surface.model)),
        extraProperty(FORMAT, rest),
      ],
      children: roots.map((id) => this.component(id)),
    });
  }

  /** The element of a component and its nested children. */
  component(id) {
    const json = this.surfaceState.components.get(id);
    const { elementId, ref } = this.claim(id, `${this.surfaceElement}-${id}`);
    const childIds = [...new Set(slotIds(json))].filter(
      (child) => this.owner.get(child) === id
    );
    const parts = this.parts(json, childIds, elementId);
    const rest = unhandled(json, parts.handled);
    return element(elementId, parts.kind, {
      positional: parts.positional,
      properties: [ref, ...parts.properties, extraProperty(FORMAT, rest)],
      children: childIds.map((child) => this.component(child)),
    });
  }

  /** The kind, positional values and properties of a component. */
  parts(json, childIds, elementId) {
    const type = json.component;
    const target = mapping.elements.get(type);
    if (!target) {
      this.diagnostics?.warning(
        'unsupported-component',
        `The ${type} component is outside the supported subset; it is kept in extra.`,
        { element: elementId }
      );
      return {
        kind: 'opaque',
        positional: [],
        properties: [prop('source', FORMAT, encodeAny(type))],
        handled: new Set(['id', 'component']),
      };
    }
    const handled = new Set(['id', 'component']);
    const properties = [];
    const positional = [];
    if (type in LAYOUT) {
      properties.push(prop(...LAYOUT[type]));
    }
    this.special(json, handled, properties, positional);
    properties.push(...this.slots(json, childIds, handled, elementId));
    for (const { key, name } of mapping.propertiesOf(type)) {
      const text = key in json ? encodeDynamic(name, json[key]) : null;
      if (text !== null && !handled.has(key)) {
        properties.push(prop(name, text));
        handled.add(key);
      }
    }
    return { kind: target.kind, positional, properties, handled };
  }

  /** The values with a type specific encoding: text, url, value, action. */
  special(json, handled, properties, positional) {
    const type = json.component;
    const use = (key, ...props) => {
      properties.push(...props);
      handled.add(key);
    };
    if (type === 'Text' && 'text' in json) {
      if (isBinding(json.text)) {
        use('text', prop('bind', json.text.path));
      } else {
        positional.push(encodeAny(json.text));
        handled.add('text');
      }
    }
    if (type === 'Image' && 'url' in json) {
      use('url', prop('source', encodeDynamic('source', json.url)));
    }
    if (INPUT_TYPES.includes(type) && 'value' in json) {
      use(
        'value',
        isBinding(json.value)
          ? prop('bind', json.value.path)
          : prop('value', encodeAny(json.value))
      );
    }
    const handler = type === 'Button' ? actionLink(json.action) : null;
    if (handler) {
      use('action', prop('on', 'press', handler));
    }
    const options = type === 'ChoicePicker' ? optionLinks(json.options) : null;
    if (options) {
      use('options', ...options);
    }
  }

  /**
   * The slot properties of a component, when its nested children say
   * exactly what its slots say; otherwise the slots stay in extra.
   */
  slots(json, childIds, handled, elementId) {
    const keys = (SLOT_KEYS[json.component] ?? []).filter((k) => k in json);
    if (keys.length === 0) {
      return [];
    }
    const parts = slotParts(json);
    const rebuilt = rebuildSlots(json.component, childIds, parts);
    const exact = keys.every((k) => isDeepStrictEqual(rebuilt[k], json[k]));
    if (!exact) {
      this.diagnostics?.info(
        'shared-children',
        `${keys.join(' and ')} name components this element does not hold (missing, shared or cyclic); the raw ids are kept in extra.`,
        { element: elementId }
      );
      return [];
    }
    keys.forEach((k) => handled.add(k));
    if (rebuilt.tabs) {
      return parts.titles.map((title) =>
        prop('tab', encodeDynamic('tab', title))
      );
    }
    return parts.repeat !== undefined && rebuilt.children
      ? [prop('repeat', ['bind', parts.repeat])]
      : [];
  }
}

/**
 * The `(emit ...)` or `(call ...)` link of a Button action, or `null`.
 * @param {unknown} action
 */
export function actionLink(action) {
  if (!isObject(action) || Object.keys(action).length !== 1) {
    return null;
  }
  const { event, functionCall } = action;
  if (isObject(functionCall)) {
    return ['call', JSON.stringify(functionCall)];
  }
  const eventKeys = isObject(event) ? Object.keys(event) : ['?'];
  if (
    typeof event?.name !== 'string' ||
    !eventKeys.every((k) => k === 'name' || k === 'context')
  ) {
    return null;
  }
  return 'context' in event
    ? ['emit', encodeAny(event.name), JSON.stringify(event.context)]
    : ['emit', encodeAny(event.name)];
}

/**
 * The `(option <value> <label>)` properties of ChoicePicker options, or
 * `null` when an option has other keys.
 * @param {unknown} options
 */
function optionLinks(options) {
  const plain = (o) =>
    isObject(o) &&
    Object.keys(o).length === 2 &&
    'label' in o &&
    'value' in o &&
    encodeDynamic('option', o.label) !== null;
  if (
    !Array.isArray(options) ||
    options.length === 0 ||
    !options.every(plain)
  ) {
    return null;
  }
  return options.map((o) =>
    prop('option', encodeAny(o.value), encodeDynamic('option', o.label))
  );
}

/** The keys of a component its element does not express. */
const unhandled = (json, handled) =>
  Object.fromEntries(Object.entries(json).filter(([key]) => !handled.has(key)));
