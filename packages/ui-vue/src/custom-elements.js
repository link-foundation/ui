/**
 * Custom element helpers: the Vue compiler option for the `ui-*` tags and
 * the host elements Vue components of custom kinds render into.
 */

/**
 * Whether a tag is a ui-dom custom element (`ui-button`, `ui-vue-host`), so
 * the Vue template compiler leaves it to the browser and does not resolve
 * a Vue component:
 *
 * ```js
 * vue({ template: { compilerOptions: { isCustomElement: isUiCustomElement } } });
 * ```
 * @param {string} tag
 */
export const isUiCustomElement = (tag) =>
  typeof tag === 'string' && tag.startsWith('ui-');

/** The tag of the element a Vue component of a custom kind renders into. */
export const UI_VUE_HOST_TAG = 'ui-vue-host';

/**
 * ui-dom kind specs (the per-render `kinds` option) that render each kind
 * of `components` as an empty `<ui-vue-host data-kind="KIND">`; the Vue
 * component is teleported into it. The element's children are not
 * rendered by ui-dom: the component owns the host.
 * @param {Record<string, unknown>|null|undefined} components
 * @param {{created?: (host: HTMLElement, el: object) => void,
 *   destroyed?: (host: HTMLElement) => void}} [hooks]
 * @returns {Record<string, import('@link-foundation/ui-dom').KindSpec>}
 */
export function hostKinds(components, hooks = {}) {
  const kinds = {};
  for (const kind of Object.keys(components ?? {})) {
    kinds[kind] = {
      tag: UI_VUE_HOST_TAG,
      childrenSlot: null,
      create(el, ctx) {
        const host = ctx.document.createElement(UI_VUE_HOST_TAG);
        host.setAttribute('data-kind', el.kind);
        hooks.created?.(host, el);
        return host;
      },
      destroy(host) {
        hooks.destroyed?.(host);
      },
    };
  }
  return kinds;
}

/**
 * The `kinds` render option with the host kinds of `components` on top of
 * the caller's own `kinds` (a Map or an object).
 * @param {Map<string, object>|Record<string, object>|undefined} own
 * @param {Record<string, object>} hosts
 */
export const withHostKinds = (own, hosts) => ({
  ...(own instanceof Map ? Object.fromEntries(own) : own),
  ...hosts,
});
