/** Read emitted or inlined browser assets without importing filesystem modules. */
export async function readAsset(url) {
  const response = await globalThis.fetch(url);
  if (!response.ok) {
    throw new Error(`Could not load ${url}: ${response.status}`);
  }
  return response.text();
}
