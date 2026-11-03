export const SHARE_PREFIX = '#ui-overrides=';
export const URL_BUDGET = 8192;

export const encodeShareHash = (text) =>
  SHARE_PREFIX + encodeURIComponent(text);

/** Malformed percent escapes are untrusted input, never an exception. */
export function decodeShareHash(hash) {
  if (typeof hash !== 'string' || !hash.startsWith(SHARE_PREFIX)) {
    return null;
  }
  try {
    return decodeURIComponent(hash.slice(SHARE_PREFIX.length));
  } catch {
    return null;
  }
}

export function shareUrl(location, text) {
  const url =
    String(location.href ?? location).split('#')[0] + encodeShareHash(text);
  return { url, tooLong: url.length > URL_BUDGET };
}
