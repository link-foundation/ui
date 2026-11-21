/** Official post widget: https://core.telegram.org/widgets/post */
import { registerEmbedProvider } from '../registry.js';
import { acquireEmbedScript } from '../script.js';

const scriptUrl = 'https://telegram.org/js/telegram-widget.js?24';

async function mountWidget(container, context) {
  const { signal } = context;
  // Telegram has no widget disposal API. Loading the SDK in an instance-owned
  // document lets the browser release its window listeners with this iframe.
  const shell = container.ownerDocument.createElement('iframe');
  shell.title = context.labels.title;
  shell.tabIndex = -1;
  shell.style.cssText = 'display:block;width:100%;height:0;border:0';
  container.append(shell);
  const doc = shell.contentDocument;
  doc.documentElement.lang = context.locale;
  doc.body.style.margin = '0';
  const referrer = doc.createElement('meta');
  referrer.name = 'referrer';
  referrer.content = 'no-referrer';
  doc.head.append(referrer);
  const post = doc.createElement('blockquote');
  post.className = 'telegram-post';
  post.dataset.telegramPost = context.id;
  post.dataset.width = '100%';
  if (context.theme === 'dark') {
    post.dataset.dark = '1';
  }
  doc.body.append(post);

  const request = acquireEmbedScript(doc, scriptUrl, {
    timeout: context.scriptTimeout,
  });
  let sizes;
  const cleanup = () => {
    signal.removeEventListener('abort', cleanup);
    request.release();
    sizes?.disconnect();
    shell.remove();
  };
  signal.addEventListener('abort', cleanup, { once: true });
  try {
    await request.promise;
    if (signal.aborted) {
      return;
    }
    // The official widget owns the remote document and validates its own
    // messages. Only mirror the height it applies in our local shell.
    const frame = doc.querySelector('iframe');
    if (!frame) {
      context.unavailable();
      cleanup();
      return;
    }
    frame.title = context.labels.title;
    Object.assign(frame.style, {
      display: 'block',
      minWidth: '0',
      maxWidth: '100%',
    });
    const syncHeight = () => {
      if (!signal.aborted && parseFloat(frame.style.height) > 0) {
        shell.style.height = frame.style.height;
        shell.removeAttribute('tabindex');
        context.ready();
      }
    };
    sizes = new context.window.MutationObserver(syncHeight);
    sizes.observe(frame, { attributes: true, attributeFilter: ['style'] });
    syncHeight();
    return cleanup;
  } catch (error) {
    cleanup();
    if (!signal.aborted) {
      throw error;
    }
  }
}

export const telegramProvider = Object.freeze({
  script: null,
  readiness: 'provider',
  validate: ({ id }) =>
    typeof id === 'string' &&
    id.trim() === id &&
    /^[A-Za-z][A-Za-z0-9_]{0,63}\/[0-9]{1,30}$/.test(id),
  url: ({ id }, { theme, locale }) =>
    `https://t.me/${id}?embed=1&dark=${theme === 'dark' ? '1' : '0'}&lang=${encodeURIComponent(locale)}`,
  async render(container, context) {
    const check = context.widgetOptions?.telegram?.checkAvailability;
    if (context.signal.aborted) {
      return;
    }
    if (check) {
      const { id, url, locale, theme, signal } = context;
      const available = await check({ id, url, locale, theme, signal });
      if (signal.aborted) {
        return;
      }
      if (!available) {
        context.unavailable();
        return;
      }
    }
    return mountWidget(container, context);
  },
});

export const unregisterTelegram = registerEmbedProvider(
  'telegram',
  telegramProvider
);
