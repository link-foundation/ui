/** VK official post widget: https://dev.vk.com/ru/widgets/post */
import { registerEmbedProvider } from '../registry.js';
const counters = new WeakMap();

export const vkProvider = Object.freeze({
  script: 'https://vk.com/js/api/openapi.js?169',
  validate: ({ id, hash }) =>
    typeof id === 'string' &&
    id.trim() === id &&
    /^-?[0-9]{1,16}_[0-9]{1,16}$/.test(id) &&
    typeof hash === 'string' &&
    hash.trim() === hash &&
    /^[A-Za-z0-9_-]{1,256}$/.test(hash),
  url: ({ id, hash }) => {
    const [owner, post] = id.split('_');
    return `https://vk.com/widget_post.php?owner_id=${owner}&post_id=${post}&hash=${encodeURIComponent(hash)}`;
  },
  render(container, context) {
    const doc = container.ownerDocument;
    const next = (counters.get(doc) ?? 0) + 1;
    counters.set(doc, next);
    container.id = `ui-embed-vk-${next}`;
    const [owner, post] = context.id.split('_');
    container.style.colorScheme = context.theme;
    container.lang = context.locale;
    const widgets = context.window.VK.Widgets;
    const widgetId = widgets.Post(container.id, owner, post, context.hash, {
      dark: context.theme === 'dark' ? 1 : 0,
      lang: context.locale,
      onReady: context.ready,
    });
    // The SDK owns resizing and exposes its RPC cleanup by widget ID.
    return () => {
      widgets.RPC?.[widgetId]?.destroy();
      if (widgets.RPC) {
        delete widgets.RPC[widgetId];
      }
    };
  },
});

export const unregisterVK = registerEmbedProvider('vk', vkProvider);
