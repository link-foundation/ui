/**
 * @link-foundation/ui-links: associative links (doublets) behind one
 * storage interface, link-cli's substitution queries over any of them,
 * types and permissions kept as links, a links protocol server and a synced
 * client that keeps a partial copy of it, and triplets over all of that.
 *
 * The TCP transport (node:net) is the separate entry point
 * `@link-foundation/ui-links/tcp`.
 */

export * from './constants.js';
export {
  LinksError,
  notFound,
  normalizeQuery,
  matches,
  linkOf,
  isAddress,
  checkParts,
  allLinks,
  getLink,
  exists,
  search,
  ensureCreated,
  decorate,
} from './links.js';
export * from './memory.js';
export * from './sql.js';
export * from './doublets-web.js';
export * from './decorators.js';
export * from './triplets.js';
export * from './triplets-query.js';
export * from './triplets-server.js';
export * from './names.js';
export * from './links-names.js';
export * from './lino.js';
export * from './query.js';
export * from './types.js';
export * from './permissions.js';
export * from './persist.js';
export * from './framing.js';
export * from './server.js';
export * from './client.js';
export * from './triplets-client.js';
