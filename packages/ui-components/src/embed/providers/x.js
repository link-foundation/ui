/** X's official factory: https://developer.x.com/en/docs/x-for-websites */
import { registerEmbedProvider } from '../registry.js';

export const xProvider = Object.freeze({
  script: 'https://platform.twitter.com/widgets.js',
  validate: ({ id }) =>
    typeof id === 'string' && id.trim() === id && /^[0-9]{1,30}$/.test(id),
  url: ({ id }) =>
    `https://platform.twitter.com/embed/Tweet.html?id=${encodeURIComponent(id)}&dnt=true`,
  async render(container, context) {
    const widget = await context.window.twttr.widgets.createTweet(
      context.id,
      container,
      {
        theme: context.theme,
        lang: context.locale,
        dnt: true,
      }
    );
    if (context.signal.aborted) {
      return;
    }
    if (widget) {
      context.ready();
    } else {
      context.unavailable();
    }
  },
});

export const unregisterX = registerEmbedProvider('x', xProvider);
