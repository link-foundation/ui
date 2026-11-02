/**
 * ui-dialect document and animations -> Lottie.
 *
 * The inverse of import.js. A `document` with its `shape` children is
 * exported as one composition with every animation that targets one of
 * its shapes. An `animation` (or a `shape`) outside a Lottie document is
 * exported as a composition of its own: one shape layer, 60 frames per
 * second and a 512 x 512 canvas unless the document says otherwise.
 */

import { Diagnostics } from '../../diagnostics.js';
import { readExtra } from '../extra.js';
import { readLino, value, values } from '../lino.js';
import { isObject } from '../safety.js';
import { decodePath } from './path.js';
import {
  FORMAT,
  NAMED_EASINGS,
  TRANSFORM,
  decodeColour,
  decodeTransform,
  isNumber,
  mapping,
  tidy,
} from './shared.js';

const DEFAULT_FRAME_RATE = 60;
const DEFAULT_SIZE = 512;

/** Item property names, in the order they may appear on a shape. */
const ITEM_NAMES = [
  'rect',
  'ellipse',
  'path',
  'fill',
  'stroke',
  'group',
  'transform',
  'item',
];

const fixed = (k) => ({ a: 0, k });
const frame = (n) => Math.round(n * 1e6) / 1e6;

/** A number atom, or `undefined`. */
function number(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return undefined;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/** `'1500ms'` or `'1.5s'` as milliseconds, or `undefined`. */
function milliseconds(raw) {
  if (typeof raw !== 'string') {
    return undefined;
  }
  if (raw.endsWith('ms')) {
    return number(raw.slice(0, -2));
  }
  const seconds = raw.endsWith('s') ? number(raw.slice(0, -1)) : undefined;
  return seconds === undefined ? undefined : seconds * 1000;
}

/** A plain JSON enum value (cap, join, fill rule) of its LiNo name. */
const enumValue = (name, raw) => number(mapping.toJson(name, raw));

/** Every node of a tree, depth first. */
function* nodes(roots) {
  for (const root of roots) {
    yield root;
    yield* nodes(root.children);
  }
}

/** Lottie `o`/`i` handles of a cubic-bezier. */
const bezier = ([ox, oy, ix, iy]) => ({
  o: { x: ox, y: oy },
  i: { x: ix, y: iy },
});

/** The Lottie keys of one part of a `(key ...)` link after its value. */
function keyPart(part) {
  if (part === 'hold') {
    return { h: 1 };
  }
  if (Array.isArray(part) && part[0] === 'cubic-bezier') {
    return bezier(part.slice(1).map(number));
  }
  if (Array.isArray(part) && part[0] === 'extra' && part[1] === FORMAT) {
    return JSON.parse(String(part[2]));
  }
  return {};
}

/** A rectangle or ellipse item, or `null` without a position and size. */
function box(name, vector, one) {
  const p = vector('at');
  const s = vector('size');
  if (!p || !s) {
    return null;
  }
  const json = { ty: name === 'rect' ? 'rc' : 'el', p: fixed(p), s: fixed(s) };
  if (name === 'rect' && one('radius') !== undefined) {
    json.r = fixed(one('radius'));
  }
  return json;
}

class LottieExporter {
  constructor(roots) {
    this.diagnostics = new Diagnostics(FORMAT);
    this.roots = roots;
  }

  /** Composition settings of a document (or the defaults). */
  composition(doc, duration) {
    const json = doc
      ? {
          ...readExtra(doc, FORMAT),
          ...mapping.exportProperties('animation', (name) => value(doc, name)),
        }
      : {};
    if (!isNumber(json.fr) || json.fr <= 0) {
      json.fr = DEFAULT_FRAME_RATE;
    }
    json.ip ??= 0;
    if (!isNumber(json.op)) {
      json.op = tidy(json.ip + ((duration ?? 1000) * json.fr) / 1000);
    }
    for (const key of ['w', 'h']) {
      if (!isNumber(json[key])) {
        this.diagnostics.info(
          'default-size',
          `The composition has no ${key === 'w' ? 'width' : 'height'}; ${DEFAULT_SIZE} is used.`,
          { element: doc?.id ?? undefined }
        );
        json[key] = DEFAULT_SIZE;
      }
    }
    return json;
  }

  /** The animations that target one of the given shapes. */
  animationsOf(shapes) {
    const ids = new Set(shapes.map((s) => s.id));
    return this.roots.filter(
      (r) => r.kind === 'animation' && ids.has(value(r, 'target'))
    );
  }

  /** The Lottie layer of a child of a document, or `null`. */
  layer(node, comp, animations) {
    if (node.kind === 'opaque') {
      const source = values(node, 'source');
      const ty = number(String(source?.[1] ?? '').slice('layer-'.length));
      if (source?.[0] === FORMAT && ty !== undefined) {
        return { ty, ...readExtra(node, FORMAT) };
      }
    }
    if (node.kind !== 'shape') {
      this.diagnostics.warning(
        'unsupported-kind',
        `Kind "${node.kind}" has no Lottie layer; it is dropped.`,
        { element: node.id ?? undefined }
      );
      return null;
    }
    return this.shapeLayer(node, comp, animations);
  }

  shapeLayer(node, comp, animations) {
    const extra = readExtra(node, FORMAT);
    const layer = {
      ty: 4,
      ...extra,
      ...mapping.exportProperties('layer-4', (name) => value(node, name)),
    };
    layer.ip ??= comp.ip;
    layer.op ??= comp.op;
    const ks = isObject(extra.ks) ? { ...extra.ks } : {};
    for (const spec of TRANSFORM) {
      const raw = value(node, spec.name);
      if (raw === undefined) {
        continue;
      }
      const decoded = decodeTransform(spec, raw);
      if (decoded) {
        ks[spec.key] = fixed(spec.vector ? decoded : decoded[0]);
      } else {
        this.bad(node, spec.name);
      }
    }
    for (const animation of animations.filter(
      (a) => value(a, 'target') === node.id
    )) {
      Object.assign(ks, this.tracks(animation, comp));
    }
    layer.ks = ks;
    layer.shapes = this.items(node.properties, node);
    return layer;
  }

  bad(node, name) {
    this.diagnostics.warning(
      'invalid-value',
      `The value of (${name} ...) cannot be read; it is dropped.`,
      { element: node.id ?? undefined }
    );
  }

  /** Shape items from ordered `(rect ...)`, `(fill ...)`, ... values. */
  items(list, node) {
    const out = [];
    for (const { name, values: raw } of list) {
      if (!ITEM_NAMES.includes(name)) {
        continue;
      }
      const item = this.item(name, raw, node);
      if (item) {
        out.push(item);
      } else {
        this.bad(node, name);
      }
    }
    return out;
  }

  item(name, raw, node) {
    if (name === 'item') {
      try {
        return JSON.parse(String(raw[0]));
      } catch {
        return null;
      }
    }
    const subs = raw.filter(Array.isArray);
    const sub = (n) => subs.find((s) => s[0] === n)?.slice(1);
    const extraLink = sub('extra');
    const extra =
      extraLink?.[0] === FORMAT ? JSON.parse(String(extraLink[1])) : {};
    const json = this.itemBody(name, raw[0], sub, subs, node);
    return json ? { ...extra, ...json } : null;
  }

  itemBody(name, head, sub, subs, node) {
    const vector = (n) => {
      const list = sub(n)?.map(number);
      return list && list.every((v) => v !== undefined) ? list : undefined;
    };
    const one = (n) => number(sub(n)?.[0]);
    switch (name) {
      case 'rect':
      case 'ellipse':
        return box(name, vector, one);
      case 'path': {
        const bezier = decodePath(head);
        return bezier ? { ty: 'sh', ks: fixed(bezier) } : null;
      }
      case 'fill':
      case 'stroke':
        return this.paint(name, head, sub, one);
      case 'group':
        return {
          ty: 'gr',
          it: this.items(
            subs
              .filter((s) => ITEM_NAMES.includes(s[0]))
              .map(([n, ...v]) => ({ name: n, values: v })),
            node
          ),
        };
      case 'transform': {
        const json = { ty: 'tr' };
        for (const spec of TRANSFORM) {
          const decoded =
            sub(spec.name) && decodeTransform(spec, sub(spec.name)[0]);
          if (decoded) {
            json[spec.key] = fixed(spec.vector ? decoded : decoded[0]);
          }
        }
        return json;
      }
      default:
        return null;
    }
  }

  paint(name, head, sub, one) {
    const c = decodeColour(head);
    if (!c) {
      return null;
    }
    const json = { ty: name === 'fill' ? 'fl' : 'st', c: fixed(c) };
    // The specification requires an opacity; LiNo leaves it out when opaque.
    json.o = fixed(
      one('opacity') === undefined ? 100 : tidy(one('opacity') * 100)
    );
    const enums =
      name === 'fill'
        ? [['r', 'fill-rule']]
        : [
            ['lc', 'cap'],
            ['lj', 'join'],
          ];
    for (const [key, n] of enums) {
      const v = sub(n) && enumValue(n, sub(n)[0]);
      if (v !== undefined) {
        json[key] = v;
      }
    }
    if (name === 'stroke') {
      if (one('width') === undefined) {
        return null;
      }
      json.w = fixed(one('width'));
      if (one('miter-limit') !== undefined) {
        json.ml = one('miter-limit');
      }
    }
    return json;
  }

  /** Animated transform properties of an animation. */
  tracks(animation, comp) {
    const duration = milliseconds(value(animation, 'duration'));
    const delay = milliseconds(value(animation, 'delay')) ?? 0;
    if (duration === undefined) {
      this.diagnostics.warning(
        'no-duration',
        'The animation has no (duration ...); it is dropped.',
        { element: animation.id ?? undefined }
      );
      return {};
    }
    const start = comp.ip + (delay * comp.fr) / 1000;
    const span = (duration * comp.fr) / 1000;
    const easing = NAMED_EASINGS[value(animation, 'easing') ?? 'linear'];
    const out = {};
    for (const [name, ...keys] of animation.properties
      .filter((p) => p.name === 'track')
      .map((p) => p.values)) {
      const spec = TRANSFORM.find((t) => t.name === name);
      const frames = spec
        ? keys.map((k, i) =>
            this.keyframe(spec, k, start, span, i === keys.length - 1, easing)
          )
        : [];
      if (!spec || frames.length === 0 || frames.includes(null)) {
        this.diagnostics.warning(
          'unsupported-track',
          `Track "${name}" is not a Lottie transform track of (key <offset> <value> ...) links; it is dropped.`,
          { element: animation.id ?? undefined }
        );
        continue;
      }
      out[spec.key] = { a: 1, k: frames };
    }
    return out;
  }

  keyframe(spec, link, start, span, last, easing) {
    if (!Array.isArray(link) || link[0] !== 'key') {
      return null;
    }
    const [, offsetText, valueText, ...rest] = link;
    const offset = number(offsetText);
    const s = decodeTransform(spec, valueText);
    if (offset === undefined || !s) {
      return null;
    }
    const json = { t: frame(start + offset * span), s };
    rest.forEach((part) => Object.assign(json, keyPart(part)));
    if (!last && !('h' in json) && !('i' in json) && !('o' in json)) {
      Object.assign(json, bezier(easing ?? NAMED_EASINGS.linear));
    }
    return json;
  }

  /** A whole document as a composition. */
  document(doc) {
    const shapes = doc.children.filter((c) => c.kind === 'shape');
    const animations = this.animationsOf(shapes);
    const comp = this.composition(doc, this.longest(animations));
    const layers = doc.children
      .map((c) => this.layer(c, comp, animations))
      .filter(Boolean);
    return { ...comp, layers };
  }

  /** A shape and the given animations as a composition of their own. */
  standalone(shape, animations, name) {
    const doc = this.roots.find(
      (r) => r.kind === 'document' && r.children.includes(shape)
    );
    const comp = this.composition(doc, this.longest(animations));
    const layer = this.shapeLayer(shape, comp, animations);
    const keep = ['v', 'ver', 'fr', 'ip', 'op', 'w', 'h'];
    return {
      ...Object.fromEntries(
        keep.filter((k) => k in comp).map((k) => [k, comp[k]])
      ),
      nm: name,
      assets: [],
      layers: [{ ind: 1, st: 0, ...layer }],
    };
  }

  /** The longest delay plus duration of some animations, in ms. */
  longest(animations) {
    const ends = animations.map(
      (a) =>
        (milliseconds(value(a, 'delay')) ?? 0) +
        (milliseconds(value(a, 'duration')) ?? 0)
    );
    return ends.length > 0 ? Math.max(...ends) : undefined;
  }
}

/**
 * Export a document, an animation or a shape as Lottie.
 * @param {string|{ roots: object[] }} doc LiNo text or a parsed document.
 * @param {string} [id] A `document` (exported whole), an `animation`
 *   (exported with its target) or a `shape` (exported with its
 *   animations). By default the first document, else the first animation.
 * @returns {{ json: object|null,
 *   diagnostics: import('../../diagnostics.js').Diagnostic[] }}
 */
export function exportLottie(doc, id) {
  const { roots } = readLino(doc);
  const exporter = new LottieExporter(roots);
  const all = [...nodes(roots)];
  const picked =
    id === undefined
      ? (roots.find((r) => r.kind === 'document') ??
        roots.find((r) => r.kind === 'animation'))
      : all.find((n) => n.id === id);
  const fail = (message) => {
    exporter.diagnostics.error('no-animation', message, { element: id });
    return { json: null, diagnostics: exporter.diagnostics.list };
  };
  if (!picked) {
    return fail(
      id === undefined
        ? 'The input has no document or animation to export.'
        : `The input has no element "${id}".`
    );
  }
  if (picked.kind === 'document') {
    return {
      json: exporter.document(picked),
      diagnostics: exporter.diagnostics.list,
    };
  }
  if (picked.kind === 'animation') {
    const target = all.find((n) => n.id === value(picked, 'target'));
    if (target?.kind !== 'shape') {
      return fail(`The target of animation "${picked.id}" is not a shape.`);
    }
    return {
      json: exporter.standalone(target, [picked], picked.id),
      diagnostics: exporter.diagnostics.list,
    };
  }
  if (picked.kind === 'shape') {
    return {
      json: exporter.standalone(
        picked,
        exporter.animationsOf([picked]),
        picked.id
      ),
      diagnostics: exporter.diagnostics.list,
    };
  }
  return fail(
    `Element "${id}" is a ${picked.kind}, not a document, animation or shape.`
  );
}
