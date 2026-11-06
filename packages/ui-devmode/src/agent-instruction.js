/* global URL */
import { readAsset } from '#read-asset';

/** Read the shipped template in Node or a browser, without bundler-specific imports. */
export async function loadAgentTemplate() {
  return await readAsset(new URL('./agent-instruction.txt', import.meta.url));
}

const template = await loadAgentTemplate();

/** Fill named placeholders with supplied values or explicit unknown markers. */
export function renderAgentInstruction(values = {}) {
  return template.replace(
    /\{(\w+)\}/g,
    (_, key) => values[key] || `<unknown ${key}>`
  );
}
