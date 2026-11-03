import { createElement, memo, useMemo } from 'react';
import { createStore } from '@link-foundation/ui-store/memory';
import {
  UiProvider,
  useUiContext,
  useUiElement,
  useUiStore,
} from '@link-foundation/ui-react/hooks';
import { mapElement } from './map.js';

const sameIds = (a, b) =>
  a.length === b.length && a.every((id, i) => id === b[i]);

/** Inject React Native primitives; tests can supply string primitives. */
export function createUiNativeView(primitives) {
  const Element = memo(function Element({ id, options }) {
    const { store, registry } = useUiContext();
    const node = useUiElement(id);
    const children = useUiStore(store, (s) => s.children(id), sameIds);
    if (!node) {
      return null;
    }
    const Custom = Object.hasOwn(options.components, node.kind)
      ? options.components[node.kind]
      : null;
    if (Custom) {
      return createElement(Custom, { id });
    }
    const mapped = mapElement(node, options);
    if (node.kind === 'button') {
      mapped.props.onPress = (event) => {
        if (mapped.props.disabled) {
          return;
        }
        for (const property of node.properties) {
          if (property.name !== 'on' || property.values[0] !== 'press') {
            continue;
          }
          for (const action of property.values.slice(1)) {
            if (!Array.isArray(action)) {
              continue;
            }
            const detail = { source: id, event: 'press', action };
            options.onAction?.(detail);
            registry.dispatch(detail, event);
          }
        }
      };
    }
    const render = (child, index) =>
      typeof child === 'string'
        ? child
        : createElement(
            primitives[child.type],
            { ...child.props, key: index },
            ...child.children.map(render)
          );
    return createElement(
      primitives[mapped.type],
      mapped.props,
      ...mapped.children.map(render),
      ...children.map((childId) =>
        createElement(Element, { key: childId, id: childId, options })
      )
    );
  });
  function Roots({ options }) {
    const { store } = useUiContext();
    const roots = useUiStore(store, (s) => s.roots(), sameIds);
    return roots.map((id) => createElement(Element, { key: id, id, options }));
  }
  return function UiNativeView({
    source,
    store,
    actions,
    onAction,
    components = EMPTY,
    styles = EMPTY,
    tokens = EMPTY,
    warn,
  }) {
    const parent = useUiContext();
    const resolved = useMemo(
      () =>
        store ??
        (source !== undefined ? createStore({ text: source }) : parent.store),
      [store, source, parent.store]
    );
    if (!resolved) {
      throw new Error('UiNativeView requires source, store or UiProvider');
    }
    const options = useMemo(
      () => ({ onAction, components, styles, tokens, warn }),
      [onAction, components, styles, tokens, warn]
    );
    return createElement(
      UiProvider,
      { store: resolved, actions },
      createElement(Roots, { options })
    );
  };
}
const EMPTY = Object.freeze({});
