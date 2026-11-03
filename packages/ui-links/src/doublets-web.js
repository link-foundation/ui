/**
 * doublets-web's `UnitedLinks` (https://github.com/linksplatform/doublets-web,
 * Unlicense) as a ui-links storage. doublets-web already has this interface;
 * the adapter turns plain queries into its `Link` class, hands out plain
 * links and throws `LinksError` for missing links. doublets-web is not a
 * dependency: pass its module, or let `openDoubletsWebLinks` import it.
 */

import { ANY, BREAK, CONTINUE, constants } from './constants.js';
import { checkParts, linkOf, normalizeQuery, notFound } from './links.js';

/**
 * Wrap a doublets-web `UnitedLinks`.
 * @param {{ Link: new (id: number, source: number, target: number) => any }} module
 * @param {any} united  a `UnitedLinks`
 */
export function fromDoubletsWeb(module, united) {
  const toQuery = (query) => {
    const q = normalizeQuery(query);
    return new module.Link(q.id, q.from_id, q.to_id);
  };
  const has = (id) =>
    Number.isSafeInteger(id) &&
    id > 0 &&
    united.count(new module.Link(id, ANY, ANY)) > 0;
  return {
    constants,
    united,
    create: () => united.create(),
    update(id, source, target) {
      if (!has(id)) {
        throw notFound(id);
      }
      checkParts(source, target);
      return united.update(id, source, target);
    },
    delete(id) {
      if (!has(id)) {
        throw notFound(id);
      }
      return united.delete(id);
    },
    count: (query) => united.count(toQuery(query)),
    each(handler, query) {
      const result = united.each(
        (link) =>
          handler(linkOf(link.id, link.from_id, link.to_id)) === BREAK
            ? BREAK
            : CONTINUE,
        toQuery(query)
      );
      return result === BREAK ? BREAK : CONTINUE;
    },
  };
}

/**
 * Load doublets-web and open an empty storage.
 * @param {() => Promise<any>} [load]  default: `() => import('doublets-web')`
 */
export async function openDoubletsWebLinks(
  load = () => import('doublets-web')
) {
  const module = await load();
  return fromDoubletsWeb(
    module,
    new module.UnitedLinks(new module.LinksConstants())
  );
}
