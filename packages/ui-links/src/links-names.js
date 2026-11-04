/**
 * Names in the data storage. Like link-cli's UnicodeStringStorage, text is
 * a sequence of doublets and a name binds a string to a data address.
 * No numeric address is reserved: the namespace is the unique `(r: 0 r)`;
 * `(z: r r)` and `(o: r z)` represent bits. A right list of these bits,
 * terminated by r, encodes UTF-16 code units, most significant bit first.
 * `(p: data text)` marked `(n: r p)` is a name. Shared text nodes are kept
 * after removal, just like other unreferenced data in a doublets storage.
 */
import { allLinks, getLink, isAddress, LinksError, search } from './links.js';
import { isName } from './names.js';

/** Decode a finite bit list; malformed, hidden or cyclic lists have no name. */
function readText(links, at, m) {
  const dependencies = [];
  const seen = new Set();
  let text = '';
  let unit = 0;
  let bits = 0;
  while (at !== m.root && !seen.has(at)) {
    seen.add(at);
    const node = getLink(links, at);
    if (!node || (node.from_id !== m.zero && node.from_id !== m.one)) {
      break;
    }
    dependencies.push(node);
    unit = unit * 2 + Number(node.from_id === m.one);
    if (++bits % 16 === 0) {
      text += String.fromCharCode(unit);
      unit = 0;
    }
    at = node.to_id;
  }
  return at === m.root && bits % 16 === 0 && isName(text)
    ? { text, dependencies }
    : null;
}

/** A names view over any storage, including a permission view or a cache. */
export function createLinksNames(links) {
  return namesView(links, links);
}

/** Preserve the authoritative storage when rebinding a restricted view. */
function namesView(links, base) {
  const pair = (source, target) => {
    const found = search(links, source, target);
    if (found) {
      return found.id;
    }
    const id = links.create();
    links.update(id, source, target);
    return id;
  };
  const markers = (create = false) => {
    for (const candidate of allLinks(links, { from_id: 0 })) {
      if (candidate.to_id !== candidate.id) {
        continue;
      }
      const root = candidate.id;
      const zero = search(links, root, root)?.id;
      const one =
        zero === undefined ? undefined : search(links, root, zero)?.id;
      if (one !== undefined) {
        return { root, zero, one };
      }
    }
    if (!create) {
      return null;
    }
    const root = links.create();
    links.update(root, 0, root);
    const zero = pair(root, root);
    return { root, zero, one: pair(root, zero) };
  };
  const records = () => {
    const m = markers();
    if (!m) {
      return [];
    }
    const result = [];
    for (const mark of allLinks(links, { from_id: m.root })) {
      if (mark.id === m.zero || mark.id === m.one) {
        continue;
      }
      const binding = getLink(links, mark.to_id);
      if (!binding || !getLink(links, binding.from_id)) {
        continue;
      }
      const dependencies = [
        mark,
        binding,
        ...Object.values(m).map((id) => getLink(links, id)),
      ];
      const decoded = readText(links, binding.to_id, m);
      if (decoded) {
        result.push({
          id: binding.from_id,
          text: decoded.text,
          mark,
          dependencies: [...dependencies, ...decoded.dependencies],
        });
      }
    }
    return result;
  };
  const assertVisible = (id, text) => {
    if (base !== links) {
      const authority = createLinksNames(base);
      const previous = authority.getName(id);
      const other = authority.getByName(text);
      if (
        (previous !== null && names.getName(id) !== previous) ||
        (other !== null && names.getByName(text) !== other) ||
        (authority.entries().length > 0 && markers() === null)
      ) {
        throw new LinksError('forbidden', 'Forbidden: hidden name encoding');
      }
    }
  };
  const names = {
    setName(id, text) {
      if (!isAddress(id) || !getLink(links, id)) {
        throw new LinksError('bad-reference', `Not a link address: ${id}`);
      }
      if (!isName(text)) {
        throw new LinksError(
          'bad-request',
          `Not a name: ${JSON.stringify(text)}`
        );
      }
      assertVisible(id, text);
      const m = markers(true);
      let tail = m.root;
      for (let i = text.length - 1; i >= 0; i--) {
        const unit = text.charCodeAt(i);
        for (let bit = 0; bit < 16; bit++) {
          tail = pair(unit & (1 << bit) ? m.one : m.zero, tail);
        }
      }
      for (const record of records()) {
        if (record.id === id || record.text === text) {
          links.delete(record.mark.id);
        }
      }
      pair(m.root, pair(id, tail));
      return id;
    },
    getName: (id) => records().find((record) => record.id === id)?.text ?? null,
    getByName: (text) =>
      records().find((record) => record.text === text)?.id ?? null,
    removeName(id) {
      assertVisible(id);
      const found = records().filter((record) => record.id === id);
      found.forEach((record) => links.delete(record.mark.id));
      return found.length > 0;
    },
    entries: () =>
      records()
        .map(({ id, text }) => [id, text])
        .sort((a, b) => a[0] - b[0]),
    /** Rebind reads/writes to a permission or transaction view. */
    withLinks: (view) => namesView(view, base),
    /** The name marks, excluding shared immutable text nodes. */
    bindings(ids) {
      const wanted = new Set(ids);
      return records()
        .filter((record) => wanted.has(record.id))
        .map((record) => record.mark);
    },
    /** The readable encoding of names of the requested data addresses. */
    dependencies(ids) {
      const wanted = new Set(ids);
      const found = new Map();
      for (const record of records()) {
        if (wanted.has(record.id)) {
          record.dependencies.forEach((link) => found.set(link.id, link));
        }
      }
      return [...found.values()];
    },
  };
  return names;
}
