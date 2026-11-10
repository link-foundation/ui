/** Official standalone post frame: https://core.telegram.org/widgets/post
 * The frame owns its scripts. No parent message listener or cross-origin reads.
 */
import { registerEmbedProvider } from '../registry.js';

export const telegramProvider = Object.freeze({
  script: null,
  validate: ({ id }) =>
    typeof id === 'string' &&
    id.trim() === id &&
    /^[A-Za-z][A-Za-z0-9_]{0,63}\/[0-9]{1,30}$/.test(id),
  url: ({ id }, { theme, locale }) =>
    `https://t.me/${id}?embed=1&dark=${theme === 'dark' ? '1' : '0'}&lang=${encodeURIComponent(locale)}`,
  render(container, context) {
    const frame = container.ownerDocument.createElement('iframe');
    frame.src = context.url;
    frame.title = context.labels.title;
    frame.referrerPolicy = 'no-referrer';
    frame.style.cssText = 'width:100%;height:0;border:0;';
    const loaded = () => {
      frame.style.height = '600px';
      context.ready();
    };
    const failed = () => context.unavailable();
    frame.addEventListener('load', loaded);
    frame.addEventListener('error', failed);
    container.append(frame);
    return () => {
      frame.removeEventListener('load', loaded);
      frame.removeEventListener('error', failed);
    };
  },
});

export const unregisterTelegram = registerEmbedProvider(
  'telegram',
  telegramProvider
);
