/** Each delivery channel implements async getItem/setItem of LiNo text. */
export const storageKey = (location) =>
  `link-ui-devmode:${location.origin}:${location.pathname}`;
export const localStorageAdapter = (storage) => ({
  getItem: async (key) => await storage.getItem(key),
  setItem: async (key, value) => await storage.setItem(key, value),
});
export const chromeStorageAdapter = (storage) => ({
  getItem: async (key) => (await storage.get(key))[key] ?? null,
  setItem: async (key, value) => await storage.set({ [key]: value }),
});
export async function loadOverrides(storage, location) {
  return (await storage.getItem(storageKey(location))) ?? '';
}
export async function saveOverrides(storage, location, overrides) {
  await storage.setItem(storageKey(location), overrides);
}

/** Cache reads for the synchronous panel and serialize delivery-channel writes. */
export async function commentStorage(storage, location) {
  const key = `${storageKey(location)}:comments`;
  let text = null;
  let restoreError = null;
  let storageError = null;
  let pending = Promise.resolve();
  try {
    text = await storage.getItem(key);
  } catch (error) {
    restoreError = error.message;
  }
  return {
    get restoreError() {
      return restoreError;
    },
    get storageError() {
      return storageError;
    },
    whenSaved: () => pending,
    getItem() {
      if (restoreError) {
        throw new Error(restoreError);
      }
      return text;
    },
    setItem(_key, value) {
      text = value;
      const write = pending.then(() => storage.setItem(key, value));
      pending = write.catch((error) => {
        storageError = error.message;
      });
      return write;
    },
  };
}
