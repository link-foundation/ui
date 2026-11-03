/** Read the shipped template in Node or a browser, without bundler-specific imports. */
export async function loadAgentTemplate() {
  const url = new globalThis.URL('./agent-instruction.txt', import.meta.url);
  if (url.protocol === 'file:') {
    const { readFile } = await import('node:fs/promises');
    return readFile(url, 'utf8');
  }
  const response = await globalThis.fetch(url);
  if (!response.ok) {
    throw new Error(`Could not load agent instruction: ${response.status}`);
  }
  return response.text();
}

const template = await loadAgentTemplate();

/** Fill named placeholders with supplied values or explicit unknown markers. */
export function renderAgentInstruction(values = {}) {
  return template.replace(
    /\{(\w+)\}/g,
    (_, key) => values[key] || `<unknown ${key}>`
  );
}
