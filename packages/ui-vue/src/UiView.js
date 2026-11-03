/**
 * `UiView`: renders a ui-store document with ui-dom inside a `<div
 * data-ui-root>`. Vue only owns the root: ui-dom patches the custom
 * elements from store events, so a store change never re-runs the Vue
 * render function. Vue components of custom kinds (`components`) render
 * into ui-dom host elements through `<Teleport>`.
 */

import {
  Fragment,
  Teleport,
  computed,
  defineComponent,
  h,
  markRaw,
  onBeforeUnmount,
  onMounted,
  provide,
  shallowReactive,
  shallowRef,
  toRaw,
  toValue,
  watch,
} from 'vue';
import { render } from '@link-foundation/ui-dom';
import { hostKinds, withHostKinds } from './custom-elements.js';
import {
  UI_ACTIONS_KEY,
  UI_STORE_KEY,
  injected,
  isDevelopment,
  isServer,
} from './keys.js';
import { createActionRegistry } from './plugin.js';
import { renderStaticHTML, storeFromSource } from './ssr.js';

/**
 * The handler names of an action, most specific first: `(emit save)` is
 * handled by `save`, then by `emit`; `(navigate home)` by `navigate`.
 * @param {readonly unknown[]} action
 */
export function actionNames(action) {
  const [head, name] = action;
  return head === 'emit' && typeof name === 'string' && name !== head
    ? [name, head]
    : [head];
}

/** The handler of a name in the `actions` prop (an object or a Map). */
function ownHandler(actions, name) {
  if (actions instanceof Map) {
    return actions.get(name);
  }
  return actions !== null &&
    typeof actions === 'object' &&
    Object.hasOwn(actions, name)
    ? actions[name]
    : undefined;
}

let nextHostKey = 0;

export const UiView = defineComponent({
  name: 'UiView',
  inheritAttrs: false,
  props: {
    /** Links Notation text; a new store is created when it changes. */
    source: { type: String, default: undefined },
    /** A ui-store store (before `source` and the injected store). */
    store: { type: Object, default: undefined },
    /** Action handlers by name (an object or a Map). */
    actions: { type: [Object, Map], default: undefined },
    /** Vue components of custom kinds, by kind. */
    components: { type: Object, default: undefined },
    /** Inline the static HTML of the document on the server. */
    ssr: { type: Boolean, default: false },
    /**
     * Other ui-dom render options (`tokens`, `styles`, `onDiagnostic`…),
     * and `parseOptions`/`storeOptions` for the store of `source`.
     */
    options: { type: Object, default: undefined },
  },
  emits: ['action'],
  setup(props, { attrs, emit }) {
    const injectedStore = injected(UI_STORE_KEY);
    const registry = createActionRegistry(undefined, injected(UI_ACTIONS_KEY));

    const sourceStore = shallowRef(null);
    watch(
      () => props.source,
      (text) => {
        sourceStore.value =
          typeof text === 'string'
            ? storeFromSource(text, props.options ?? {})
            : null;
      },
      { immediate: true }
    );
    const store = computed(
      () => props.store ?? sourceStore.value ?? toValue(injectedStore) ?? null
    );
    provide(UI_STORE_KEY, store);
    provide(UI_ACTIONS_KEY, registry);

    /** The host elements of custom kinds, in creation order. */
    const hosts = shallowReactive([]);
    const root = shallowRef(null);
    let handle = null;

    const warned = new Set();
    const onAction = (detail, event) => {
      emit('action', detail, event);
      for (const name of actionNames(detail.action)) {
        const own = ownHandler(props.actions, name);
        const handlers =
          typeof own === 'function' ? [own] : registry.handlers(name);
        if (handlers.length > 0) {
          handlers.forEach((handler) => handler(detail, event));
          return;
        }
      }
      const [name] = actionNames(detail.action);
      if (isDevelopment() && !warned.has(name)) {
        warned.add(name);
        console.warn(
          `[ui-vue] UiView: no handler for the action "${name}" (from "${detail.source}"); pass it in the actions prop or register it with useUiAction.`
        );
      }
    };

    /**
     * Without an `onDiagnostic` option, an action head outside the dialect
     * vocabulary (ui-dom ignores it) is a development warning: host actions
     * are written `(emit NAME)`.
     */
    const onDiagnostic = (d) => {
      const name = d.at?.action;
      if (d.code !== 'unknown-action' || !isDevelopment() || warned.has(name)) {
        return;
      }
      warned.add(name);
      console.warn(
        `[ui-vue] UiView: ${d.message}. Write host actions as (emit ${name}).`
      );
    };

    /** Follow renames: the components receive the current ID. */
    const onPatch = (events) => {
      if (handle === null || !events.some((e) => e.type === 'rename')) {
        return;
      }
      hosts.forEach((entry, i) => {
        const id = handle.idFor(entry.host);
        if (id !== null && id !== entry.id) {
          hosts.splice(i, 1, markRaw({ ...entry, id }));
        }
      });
    };

    const kinds = () =>
      hostKinds(props.components, {
        created(host, el) {
          hosts.push(
            markRaw({ key: (nextHostKey += 1), id: el.id, kind: el.kind, host })
          );
        },
        destroyed(host) {
          const i = hosts.findIndex((entry) => entry.host === host);
          if (i >= 0) {
            hosts.splice(i, 1);
          }
        },
      });

    const unmountView = () => {
      handle?.destroy();
      handle = null;
      if (hosts.length > 0) {
        hosts.splice(0);
      }
    };

    const mountView = () => {
      unmountView();
      const element = root.value;
      const current = store.value;
      if (element === null) {
        return;
      }
      // Server markup (the `ssr` prop) is replaced by the live render.
      element.replaceChildren();
      if (current === null) {
        if (isDevelopment()) {
          console.warn(
            '[ui-vue] UiView: no store. Pass source or store, or install createUiPlugin({ store }).'
          );
        }
        return;
      }
      const options = props.options ?? {};
      handle = render(element, current, {
        ...options,
        kinds: withHostKinds(options.kinds, kinds()),
        onAction(detail, event) {
          options.onAction?.(detail, event);
          onAction(detail, event);
        },
        onPatch(events) {
          onPatch(events);
          options.onPatch?.(events);
        },
        onDiagnostic: options.onDiagnostic ?? onDiagnostic,
      });
    };

    onMounted(() => {
      mountView();
      watch(
        [
          store,
          () => props.options,
          () => Object.keys(props.components ?? {}).join('\n'),
        ],
        mountView
      );
    });
    onBeforeUnmount(unmountView);

    const server = isServer();
    const staticHTML = () =>
      props.ssr && server && store.value !== null
        ? renderStaticHTML(store.value, props.options, props.components)
        : undefined;

    return () =>
      h(Fragment, [
        h('div', {
          ...attrs,
          key: 'root',
          ref: root,
          'data-ui-root': '',
          innerHTML: staticHTML(),
        }),
        ...hosts.map((entry) => {
          // The props of a test or a parent may be deeply reactive.
          const component = toRaw(props.components ?? {})[entry.kind];
          return h(
            Teleport,
            { key: entry.key, to: entry.host },
            component === undefined
              ? []
              : [h(toRaw(component), { id: entry.id })]
          );
        }),
      ]);
  },
});

export default UiView;
