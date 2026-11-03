/**
 * `<UiView source | store, actions, onAction, components, className />`:
 * mount the ui-dom renderer into a `<div data-ui-root>` and keep it until
 * unmount. React renders the container once; ui-dom patches the nodes from
 * store events, so a store change never re-renders `<UiView>`.
 */

import { createElement, useMemo, useRef, useState } from 'react';
import { render } from '@link-foundation/ui-dom';
import {
  UiContext,
  useActionRegistry,
  useIsomorphicLayoutEffect,
  useUiContext,
} from './context.js';
import {
  UiPortals,
  createHostRegistry,
  kindNamesOf,
  withHostKinds,
} from './components.js';
import { renderViewToHTML } from './ssr.js';
import { shallowEqual, storeOfSource } from './store.js';

/** Props that are not ui-dom render options. */
const OWN_PROPS = new Set([
  'source',
  'store',
  'actions',
  'onAction',
  'onDiagnostic',
  'onPatch',
  'components',
  'className',
  'style',
  'id',
  'ssr',
  'parseOptions',
  'handleRef',
]);

/** The render options among the props, the same object while equal. */
function useRenderOptions(props) {
  const options = {};
  for (const [key, value] of Object.entries(props)) {
    if (!OWN_PROPS.has(key) && value !== undefined) {
      options[key] = value;
    }
  }
  const ref = useRef(options);
  if (!shallowEqual(ref.current, options)) {
    ref.current = options;
  }
  return ref.current;
}

/** The store of the view and the diagnostics of its `source`. */
function useViewStore(props, context) {
  const { source, parseOptions } = props;
  const parsed = useMemo(
    () =>
      typeof source === 'string' ? storeOfSource(source, parseOptions) : null,
    // A new `parseOptions` object each render must not reparse.
    [source]
  );
  const store = props.store ?? parsed?.store ?? context.store;
  if (store === null || store === undefined) {
    throw new Error(
      '<UiView>: pass `source` or `store`, or render inside <UiProvider store>'
    );
  }
  return { store, diagnostics: props.store ? [] : (parsed?.diagnostics ?? []) };
}

/**
 * Mount ui-dom for `store` while the view is mounted (layout effect: no
 * flash of an empty container). Under `<StrictMode>` the effect runs,
 * cleans up and runs again, so every resource is released by the cleanup.
 */
function useMount(ref, view) {
  const { store, options, kindNames, hosts, registry, ssr, latest } = view;
  useIsomorphicLayoutEffect(() => {
    const container = ref.current;
    if (ssr) {
      // The inline server HTML is replaced by live nodes.
      container.replaceChildren();
    }
    const onDiagnostic = (d) => latest.current.onDiagnostic?.(d);
    latest.current.diagnostics.forEach(onDiagnostic);
    const handle = render(container, store, {
      ...options,
      kinds: withHostKinds(
        options.kinds,
        kindNames === '' ? [] : kindNames.split('\n'),
        hosts
      ),
      onDiagnostic,
      onPatch: (events) => latest.current.onPatch?.(events),
    });
    const unwatch = store.subscribe((events) => {
      for (const event of events) {
        if (event.type === 'rename') {
          hosts.rename(event.before, event.id);
        }
      }
    });
    const onUiAction = (event) => {
      const detail = event.detail;
      // Only actions of this view: a nested view's nodes are not ours.
      if (!detail || handle.nodeFor(detail.source) !== event.target) {
        return;
      }
      latest.current.onAction?.(detail, event);
      registry.dispatch(detail, event);
    };
    container.addEventListener('ui-action', onUiAction);
    if (latest.current.handleRef) {
      latest.current.handleRef.current = handle;
    }
    return () => {
      container.removeEventListener('ui-action', onUiAction);
      unwatch();
      handle.destroy();
      hosts.clear();
      if (latest.current.handleRef?.current === handle) {
        latest.current.handleRef.current = null;
      }
    };
  }, [ref, store, options, kindNames, hosts, registry, ssr, latest]);
}

/**
 * @param {import('./index.d.ts').UiViewProps} props
 */
export function UiView(props) {
  const { actions, components, className, style, id, ssr = false } = props;
  const context = useUiContext();
  const { store, diagnostics } = useViewStore(props, context);
  const registry = useActionRegistry(actions, context.registry);
  const options = useRenderOptions(props);
  const kindNames = kindNamesOf(components);
  const [hosts] = useState(createHostRegistry);
  const ref = useRef(null);
  const latest = useRef(null);
  latest.current = {
    onAction: props.onAction,
    onDiagnostic: props.onDiagnostic,
    onPatch: props.onPatch,
    handleRef: props.handleRef,
    diagnostics,
  };
  useMount(ref, { store, options, kindNames, hosts, registry, ssr, latest });

  const html = useMemo(
    () =>
      ssr
        ? renderViewToHTML(store, {
            kinds: options.kinds,
            prefix: options.prefix,
            componentKinds: kindNames === '' ? [] : kindNames.split('\n'),
          })
        : null,
    [ssr, store, options.kinds, options.prefix, kindNames]
  );
  const value = useMemo(() => ({ store, registry }), [store, registry]);
  const root = createElement('div', {
    ref,
    id,
    className,
    style,
    'data-ui-root': '',
    ...(html === null ? {} : { dangerouslySetInnerHTML: { __html: html } }),
  });
  return createElement(
    UiContext.Provider,
    { value },
    root,
    components ? createElement(UiPortals, { hosts, components }) : null
  );
}
