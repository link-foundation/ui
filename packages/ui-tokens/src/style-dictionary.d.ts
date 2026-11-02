import type { ResolvedTokens } from './index.js';

/**
 * Build the tokens with Style Dictionary: they are written as a DTCG
 * 2025.10 file to a temporary directory, which is the `source` of the
 * config. `style-dictionary` is an optional peer dependency.
 */
export function buildWithStyleDictionary(
  resolved: ResolvedTokens,
  config: Record<string, unknown>,
  options?: { StyleDictionary?: unknown; keepAliases?: boolean }
): Promise<unknown>;
