/** Stable handles `(id: 0 value)` over the immutable document encoding. */
import { documentString } from './string-names.js';
import { check } from '../errors.js';
import { decodeDocument } from './encode.js';

const CONTINUE = 4294967295;
export function linkAt(links, id) {
  let found;
  links.each(
    (link) => {
      found = link;
      return CONTINUE;
    },
    { id }
  );
  return found;
}

/** Immutable fragments are interned; only element and root handles change. */
export function documentWriter(links, names) {
  const resolve = (id) => links.resolve?.(id) ?? id;
  const pointCache = new Map();
  const pairCache = new Map();
  const point = (text) => {
    let id =
      pointCache.get(text) ?? names.get?.(text) ?? names.getByName?.(text);
    if (
      id !== null &&
      id !== undefined &&
      (!links.each || linkAt(links, resolve(id)))
    ) {
      pointCache.set(text, id);
      return resolve(id);
    }
    id = links.create();
    links.update(id, id, id);
    if (names.setName) {
      names.setName(id, text);
    } else {
      names.set(text, id);
    }
    pointCache.set(text, id);
    return id;
  };
  const pair = (source, target) => {
    const key = `${source} ${target}`;
    let found = links.each ? undefined : pairCache.get(key);
    links.each?.(
      (link) => {
        found ??= link.id;
        return CONTINUE;
      },
      { from_id: source, to_id: target }
    );
    if (found !== undefined) {
      return found;
    }
    const id = links.create();
    links.update(id, source, target);
    pairCache.set(key, id);
    return id;
  };
  const handle = (value, previous) => {
    const id = previous === undefined ? links.create() : resolve(previous);
    const before = links.each ? linkAt(links, id) : null;
    if (before?.from_id !== 0 || before?.to_id !== value) {
      links.update(id, 0, value);
    }
    return id;
  };
  const nil = () => pair(point('list'), point('end'));
  const sequence = (items) => items.reduce(pair, nil());
  const value = (v) =>
    typeof v === 'string'
      ? point(v)
      : Array.isArray(v)
        ? pair(nil(), values(v))
        : pair(point(v.id), values(v.values));
  const values = (list) => sequence((list ?? []).map(value));
  const element = (node, key, children, handles) => {
    const body = sequence([
      values(node.kind === null || node.kind === undefined ? [] : [node.kind]),
      values(node.positional),
      sequence(
        (node.properties ?? []).map((p) =>
          pair(point(p.name), values(p.values))
        )
      ),
      sequence(children),
      values(node.unknown),
    ]);
    const encoded =
      node.id === null || node.id === undefined
        ? body
        : pair(point(node.id), body);
    const id = handle(encoded, handles.get(key));
    handles.set(key, id);
    return id;
  };
  return { point, pair, handle, sequence, values, element, resolve };
}

/** Read mutable graphs as a canonical, ordered snapshot for decodeDocument. */
export function readGraph(links, { roots, names = links.names }) {
  check(
    Array.isArray(roots) && roots.length === 2,
    'bad-doublets',
    'roots must be [elements, unknown]'
  );
  const resolve = (id) => links.resolve?.(id) ?? id;
  const points = new Map();
  const live = linkAt(links, resolve(roots[0]))?.from_id === 0;
  const decodeName = (text) => (live ? documentString(text) : text);
  const byId = names?.entriesById
    ? new Map(names.entriesById())
    : names?.entries && names?.getName
      ? new Map(
          names.entries().map(([id, text]) => [resolve(id), decodeName(text)])
        )
      : names?.getName
        ? null
        : new Map([...names].map(([s, i]) => [resolve(i), s]));
  const rows = [];
  const done = new Map();
  const active = new Set();
  const get = (id) => {
    const link = linkAt(links, resolve(id));
    check(link, 'bad-doublets', `Link ${id} does not exist`);
    return link;
  };
  const visit = (id) => {
    id = resolve(id);
    if (done.has(id)) {
      return done.get(id);
    }
    check(!active.has(id), 'bad-doublets', `Cycle at link ${id}`);
    active.add(id);
    const link = get(id);
    let index;
    if (link.from_id === 0) {
      index = visit(link.to_id);
    } else if (link.from_id === id && link.to_id === id) {
      index = rows.length + 1;
      const name = byId ? byId.get(id) : decodeName(names.getName(id));
      check(
        name !== null && name !== undefined,
        'bad-doublets',
        `Point ${id} has no name`
      );
      if (points.has(name)) {
        index = points.get(name);
      } else {
        points.set(name, index);
        rows.push({ index, source: index, target: index });
      }
    } else {
      const source = visit(link.from_id);
      const target = visit(link.to_id);
      index = rows.length + 1;
      rows.push({ index, source, target });
    }
    done.set(id, index);
    active.delete(id);
    return index;
  };
  const document = decodeDocument({
    roots: roots.map(visit),
    links: rows,
    names: points,
  });
  const unwrap = (id) => {
    const l = get(id);
    return l.from_id === 0 ? unwrap(l.to_id) : resolve(id);
  };
  const isNil = (id) => {
    const l = get(unwrap(id));
    const name = (p) => (byId ? byId.get(p) : names.getName(p));
    return name(l.from_id) === 'list' && name(l.to_id) === 'end';
  };
  const sequence = (id) => {
    const result = [];
    for (let at = unwrap(id); !isNil(at); ) {
      const l = get(at);
      result.push(l.to_id);
      at = unwrap(l.from_id);
    }
    return result.reverse();
  };
  const handles = [];
  const walk = (ids, nodes) =>
    ids.forEach((id, i) => {
      handles.push(resolve(id));
      const l = get(unwrap(id));
      const body =
        nodes[i].id === null || nodes[i].id === undefined
          ? unwrap(id)
          : l.to_id;
      walk(sequence(sequence(body)[3]), nodes[i].children);
    });
  walk(sequence(roots[0]), document.roots);
  return { document, handles, reachable: new Set(done.keys()) };
}
