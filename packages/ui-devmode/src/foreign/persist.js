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
