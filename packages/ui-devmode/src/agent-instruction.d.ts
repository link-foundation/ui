export function loadAgentTemplate(): Promise<string>;
export function renderAgentInstruction(values?: {
  repository?: string;
  siteConfig?: string;
  overrides?: string;
}): string;
