/** Opt-in embeds. Import provider adapters separately to populate the allow-list. */
export { registerEmbedProvider, getEmbedProvider } from './registry.js';
export { loadEmbedScript } from './script.js';
export { createEmbed } from './controller.js';
export {
  defineEmbedElement,
  embedVocabulary,
  EMBED_KIND_TEXT,
} from './element.js';
