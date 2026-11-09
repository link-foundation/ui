import { applyToRoot } from '@link-foundation/ui-settings';

/** Hosts may render site-specific content; the default uses the same projection as the live preview. */
export function miniature(context, parent, values, detail = {}) {
  const container = context.node('div', undefined, parent);
  container.className = 'settings-miniature';
  container.setAttribute('aria-hidden', 'true');
  container.inert = true;
  const custom = context.options.mountMiniature?.({
    container,
    values,
    ...detail,
  });
  if (!custom) {
    context.node('span', 'Aa', container);
  }
  return {
    update(next) {
      applyToRoot(context.schema, next, container, {
        project: context.options.project,
      });
      custom?.update?.(next);
    },
    destroy: () => custom?.destroy?.(),
  };
}
