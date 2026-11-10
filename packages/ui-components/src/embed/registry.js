/** Adapters are trusted application code, never document-provided URLs/code. */
const providers = new Map();

export function registerEmbedProvider(name, adapter) {
  if (!/^[a-z][a-z0-9-]*$/.test(name) || !adapter) {
    throw new TypeError('Invalid embed provider');
  }
  for (const key of ['validate', 'url', 'render']) {
    if (typeof adapter[key] !== 'function') {
      throw new TypeError(`Embed provider requires ${key}`);
    }
  }
  if (adapter.script !== null && !isEmbedUrl(adapter.script)) {
    throw new TypeError('Embed scripts require an absolute HTTPS URL');
  }
  const value = Object.freeze({ ...adapter });
  providers.set(name, value);
  return () => {
    if (providers.get(name) === value) {
      providers.delete(name);
    }
  };
}

export const getEmbedProvider = (name) => providers.get(name);

/** Do not allow credentials, relative URLs or executable URL schemes. */
export function isEmbedUrl(value) {
  try {
    const url = new globalThis.URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}
