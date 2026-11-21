const templates = Object.freeze({
  X: 'https://twitter.com/intent/tweet?url={url}&text={title}',
  Telegram: 'https://t.me/share/url?url={url}&text={title}',
  VK: 'https://vk.com/share.php?url={url}&title={title}',
  Facebook: 'https://www.facebook.com/sharer/sharer.php?u={url}',
  LinkedIn: 'https://www.linkedin.com/sharing/share-offsite/?url={url}',
  Reddit: 'https://www.reddit.com/submit?url={url}&title={title}',
  Bluesky: 'https://bsky.app/intent/compose?text={title}%20{url}',
  Mastodon: '{mastodonOrigin}/share?text={title}%20{url}',
  WhatsApp: 'https://wa.me/?text={title}%20{url}',
  'e-mail': 'mailto:?subject={title}&body={emailBody}',
});

export const networkShareDestinations = Object.freeze(
  Object.fromEntries(
    Object.entries(templates).map(([id, template]) => [
      id,
      Object.freeze({ label: id, template }),
    ])
  )
);

function substitute(template, values) {
  return template.replace(/\{([\w]+)\}/gu, (token, key) =>
    Object.hasOwn(values, key) ? values[key] : token
  );
}

function mastodonOrigin(instance) {
  const url = new globalThis.URL(
    instance.includes('://') ? instance : `https://${instance}`
  );
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new TypeError('Invalid Mastodon instance');
  }
  return url.origin;
}

/** Build destination URLs from templates with individually encoded values. */
export function networkShareTargets(
  url,
  title = 'Links network',
  {
    mastodonInstance = 'mastodon.social',
    emailBody = '{title}\n\n{url}',
    destinations = networkShareDestinations,
  } = {}
) {
  const values = {
    url: encodeURIComponent(url),
    title: encodeURIComponent(title),
    emailBody: encodeURIComponent(substitute(emailBody, { url, title })),
  };
  return Object.fromEntries(
    Object.entries(destinations).map(([id, { template }]) => {
      const params = template.includes('{mastodonOrigin}')
        ? { ...values, mastodonOrigin: mastodonOrigin(mastodonInstance) }
        : values;
      return [id, substitute(template, params)];
    })
  );
}
