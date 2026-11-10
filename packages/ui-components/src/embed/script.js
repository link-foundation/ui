/** Shared per document. Pending requests are canceled when their last user leaves. */
import { isEmbedUrl } from './registry.js';
const pages = new WeakMap();

function requestScript(document, url, timeout) {
  if (!isEmbedUrl(url)) {
    throw new TypeError('Unsafe embed script URL');
  }
  let cache = pages.get(document);
  if (!cache) {
    cache = new Map();
    pages.set(document, cache);
  }
  if (cache.has(url)) {
    return cache.get(url);
  }
  const win = document.defaultView;
  const script = document.createElement('script');
  script.src = url;
  script.async = true;
  script.referrerPolicy = 'no-referrer';
  const entry = { users: 0, pending: true };
  entry.promise = new Promise((resolve, reject) => {
    const timer = win.setTimeout(() => entry.cancel(), timeout);
    const finish = (ok) => {
      if (!entry.pending) {
        return;
      }
      entry.pending = false;
      win.clearTimeout(timer);
      script.onload = null;
      script.onerror = null;
      if (ok) {
        resolve();
      } else {
        cache.delete(url);
        script.remove();
        reject(new Error('Embed script failed or timed out'));
      }
    };
    entry.cancel = () => finish(false);
    script.onload = () => finish(true);
    script.onerror = entry.cancel;
  });
  cache.set(url, entry);
  (document.head ?? document.documentElement).append(script);
  return entry;
}

/** Low-level page-owned request; use acquireEmbedScript for disposable widgets. */
export function loadEmbedScript(document, url, { timeout = 10000 } = {}) {
  const entry = requestScript(document, url, timeout);
  entry.users++;
  return entry.promise;
}

export function acquireEmbedScript(document, url, { timeout = 10000 } = {}) {
  const entry = requestScript(document, url, timeout);
  entry.users++;
  let released = false;
  return {
    promise: entry.promise,
    release() {
      if (!released) {
        released = true;
        entry.users--;
        if (entry.users === 0 && entry.pending) {
          entry.cancel();
        }
      }
    },
  };
}
