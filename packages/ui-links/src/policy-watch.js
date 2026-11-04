/** A server-local cache; ordinary permission views always read live rules. */
import { allLinks, getLink } from './links.js';

export function watchPolicy({ rules, markers, types }) {
  const cache = new Map();
  const readRules = () => {
    const out = new Map();
    for (const marker of [markers.allowRead, markers.allowWrite]) {
      for (const mark of allLinks(rules, { from_id: marker })) {
        const rule = getLink(rules, mark.to_id);
        if (rule) {
          out.set(rule.id, rule);
        }
      }
    }
    return out;
  };
  let granted = readRules();
  const isSubject = (subject, type) =>
    type === markers.anything || (subject !== null && types.isA(subject, type));
  return {
    canRead(subject, link) {
      if (!cache.has(subject)) {
        cache.set(
          subject,
          new Set(
            [...granted.values()]
              .filter((rule) => isSubject(subject, rule.from_id))
              .map((rule) => rule.to_id)
          )
        );
      }
      for (const type of cache.get(subject)) {
        if (type === markers.anything || types.isOf(link, type)) {
          return true;
        }
      }
      return false;
    },
    /** Invalidate only subjects mentioned by a changed rule, unless types changed. */
    refresh(changes, storage) {
      const ids = new Set(
        changes.map(({ before, after }) => (after ?? before).id)
      );
      const hierarchy = types.affects(changes, storage);
      const ruleChange =
        storage === rules &&
        changes.some(({ before, after }) =>
          [before, after].some(
            (link) =>
              link &&
              (granted.has(link.id) ||
                link.from_id === markers.allowRead ||
                link.from_id === markers.allowWrite ||
                Object.values(markers).includes(link.id))
          )
        );
      const subjects = new Set();
      if (ruleChange) {
        const current = readRules();
        for (const id of new Set([...granted.keys(), ...current.keys()])) {
          const before = granted.get(id);
          const after = current.get(id);
          if (
            before?.from_id !== after?.from_id ||
            before?.to_id !== after?.to_id
          ) {
            if (before) {
              subjects.add(before.from_id);
            }
            if (after) {
              subjects.add(after.from_id);
            }
          }
        }
        granted = current;
      }
      const affected = (subject) =>
        hierarchy ||
        (storage === types.links && ids.has(subject)) ||
        [...subjects].some((type) => isSubject(subject, type));
      for (const subject of cache.keys()) {
        if (affected(subject)) {
          cache.delete(subject);
        }
      }
      return affected;
    },
    forget: (subject) => cache.delete(subject),
  };
}
