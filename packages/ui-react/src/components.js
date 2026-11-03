/**
 * React components for custom dialect kinds: the `components` prop of
 * `<UiView>` (`{ chart: MyChart }`).
 *
 * Each named kind gets a ui-dom kind spec for that render only (the
 * `kinds` render option, so two views never share it): its node is a
 * `<ui-react-host data-kind="chart">` element, and `<UiView>` renders
 * `<MyChart id props children />` into it with `createPortal`. `props` are
 * the element properties by name and update incrementally from the store
 * (`useUiProps`), so a property change re-renders only that component.
 * `children` are the ui-dom nodes of the element's children: they live in a
 * `<ui-react-slot>` that moves to where the component renders `children`.
 */

import {
  createElement,
  useCallback,
  useRef,
  useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';
import { useIsomorphicLayoutEffect } from './context.js';
import { useUiProps } from './hooks.js';

/** The tag of the node a React component renders into. */
export const HOST_TAG = 'ui-react-host';
/** The tag of the node the children of a host element are rendered in. */
export const SLOT_TAG = 'ui-react-slot';

/**
 * @typedef {{key: string, host: HTMLElement, slot: HTMLElement,
 *   kind: string, id: string}} HostEntry
 */

/**
 * The host elements of one `<UiView>`: a tiny external store the portals
 * subscribe to, so `<UiView>` itself never re-renders when hosts appear.
 */
export function createHostRegistry() {
  /** @type {readonly HostEntry[]} */
  let entries = Object.freeze([]);
  const listeners = new Set();
  let next = 0;
  const set = (list) => {
    entries = Object.freeze(list);
    for (const listener of [...listeners]) {
      listener();
    }
  };
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    snapshot: () => entries,
    /** @param {Omit<HostEntry, 'key'>} entry */
    add(entry) {
      next += 1;
      set([...entries, Object.freeze({ ...entry, key: `host-${next}` })]);
    },
    remove(host) {
      if (entries.some((e) => e.host === host)) {
        set(entries.filter((e) => e.host !== host));
      }
    },
    /** Follow a store rename of an element. */
    rename(before, id) {
      if (entries.some((e) => e.id === before)) {
        set(entries.map((e) => (e.id === before ? { ...e, id } : e)));
      }
    },
    clear() {
      if (entries.length > 0) {
        set([]);
      }
    },
    listenerCount: () => listeners.size,
  };
}

/** The slot of every host node (the slot moves out of its host). */
const slots = new WeakMap();

/**
 * The ui-dom kind spec of a React-rendered kind.
 * @param {string} kind
 * @param {ReturnType<typeof createHostRegistry>|null} hosts  where live
 *   hosts are recorded; `null` for static HTML
 */
export function hostKind(kind, hosts) {
  return {
    tag: HOST_TAG,
    create(el, ctx) {
      const host = ctx.document.createElement(HOST_TAG);
      host.setAttribute('data-kind', kind);
      const slot = ctx.document.createElement(SLOT_TAG);
      slot.style.setProperty('display', 'contents');
      host.appendChild(slot);
      if (hosts !== null) {
        slots.set(host, slot);
        hosts.add({ host, slot, kind, id: el.id });
      }
      return host;
    },
    childrenSlot: (host) => slots.get(host) ?? host.firstChild ?? host,
    destroy(host) {
      hosts?.remove(host);
    },
  };
}

/**
 * The kind specs of a `components` prop.
 * @param {readonly string[]} names
 * @param {ReturnType<typeof createHostRegistry>|null} hosts
 */
export function hostKinds(names, hosts) {
  return Object.fromEntries(names.map((name) => [name, hostKind(name, hosts)]));
}

/**
 * The `kinds` render option with the host kinds of `names` added.
 * @param {Map<string, object>|Record<string, object>|undefined} kinds
 * @param {readonly string[]} names
 * @param {ReturnType<typeof createHostRegistry>|null} hosts
 */
export function withHostKinds(kinds, names, hosts) {
  const own = kinds instanceof Map ? Object.fromEntries(kinds) : kinds;
  return { ...own, ...hostKinds(names, hosts) };
}

/** The sorted kind names of a `components` prop (a stable effect key). */
export const kindNamesOf = (components) =>
  components === null || components === undefined
    ? ''
    : Object.keys(components)
        .filter((name) => components[name] !== undefined)
        .sort()
        .join('\n');

/**
 * The ui-dom children of a host element, wherever the component renders
 * them.
 * @param {{slot: HTMLElement, host: HTMLElement}} props
 */
function UiChildren({ slot, host }) {
  const ref = useRef(null);
  useIsomorphicLayoutEffect(() => {
    ref.current.appendChild(slot);
    return () => {
      if (slot.parentNode === ref.current || slot.parentNode === null) {
        host.appendChild(slot);
      }
    };
  }, [slot, host]);
  return createElement('div', {
    ref,
    'data-ui-children': '',
    style: { display: 'contents' },
  });
}

/** One React component in its host element. */
function UiHostPortal({ entry, component }) {
  const props = useUiProps(entry.id);
  const children = createElement(UiChildren, {
    slot: entry.slot,
    host: entry.host,
  });
  return createPortal(
    createElement(component, { id: entry.id, props: props ?? {}, children }),
    entry.host
  );
}

/**
 * The portals of every live host of a view.
 * @param {{hosts: ReturnType<typeof createHostRegistry>,
 *   components: Record<string, import('react').ComponentType<any>>}} props
 */
export function UiPortals({ hosts, components }) {
  const subscribe = useCallback(
    (listener) => hosts.subscribe(listener),
    [hosts]
  );
  const entries = useSyncExternalStore(
    subscribe,
    hosts.snapshot,
    hosts.snapshot
  );
  return entries
    .filter(
      (entry) =>
        typeof components[entry.kind] === 'function' ||
        typeof components[entry.kind] === 'object'
    )
    .map((entry) =>
      createElement(UiHostPortal, {
        key: entry.key,
        entry,
        component: components[entry.kind],
      })
    );
}
