/**
 * Lottie -> ui-dialect document and animations.
 *
 * The composition becomes a `document` whose children are its layers in
 * Lottie order. A shape layer (`ty: 4`) becomes a `shape` element: its
 * static transform is written as properties (`(opacity 1)`,
 * `(translate '10px 20px')`, ...) and its shape items as ordered
 * properties (`(rect ...)`, `(ellipse ...)`, `(path '<svg>')`,
 * `(fill '#RRGGBB')`, `(stroke ...)`, `(group ...)`, `(transform ...)`).
 * The animated transform of a layer becomes an `animation` root after the
 * document: `(target <layer>)`, `(duration <ms>)` and one `(track ...)` per
 * property with `(key <offset 0..1> <value> [(cubic-bezier ...)|hold])`.
 *
 * Outside the supported subset:
 * - text, image and audio layers, effects, expressions, image assets and
 *   precompositions nested more than one level deep are rejected with an
 *   error diagnostic and dropped; nothing is ever evaluated;
 * - other layers (precomposition, solid, null) and shape items the mapping
 *   does not cover are kept whole as JSON, with a warning.
 */

import { Diagnostics } from '../../diagnostics.js';
import { encodeAny, extraProperty } from '../extra.js';
import { IdAllocator, element, prop, writeLino } from '../lino.js';
import { isObject } from '../safety.js';
import { encodePath } from './path.js';
import {
  FORMAT,
  LOTTIE_VERSION,
  TRANSFORM,
  encodeColour,
  encodeTransform,
  isAnimated,
  isNumber,
  isVector,
  mapping,
  num,
  staticValue,
  tidy,
  tidyNum,
  transformRoundTrips,
  walkJson,
} from './shared.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

/** Layer types rejected with an error. */
const REJECTED_LAYERS = { 2: 'image', 5: 'text', 6: 'audio' };

/** Keys of an animatable property object the converter understands. */
const PROPERTY_KEYS = ['a', 'k', 'ix'];

/** Keyframe keys turned into a `(key ...)` link. */
const KEY_KEYS = ['t', 's', 'i', 'o', 'h'];
const EASING_KEYS = ['i', 'o', 'h'];

/** One number of an easing handle component, or `undefined`. */
function handle(component) {
  if (isNumber(component)) {
    return component;
  }
  if (isVector(component) && component.every((n) => n === component[0])) {
    return component[0];
  }
  return undefined;
}

class LottieImporter {
  constructor(json) {
    this.diagnostics = new Diagnostics(FORMAT);
    this.ids = new IdAllocator();
    this.json = json;
    this.ip = json.ip;
    this.op = json.op;
    /** Animation roots, written after the document. */
    this.animations = [];
  }

  /** Remove what is rejected: expressions, effects, image assets, deep precomps. */
  reject() {
    walkJson(this.json, (object, path) => {
      if ('x' in object && ('k' in object || 'a' in object)) {
        this.diagnostics.error(
          'expression',
          'Expressions are not supported and are never evaluated; the expression is dropped.',
          { path: `${path}/x` }
        );
        delete object.x;
      }
      if (Array.isArray(object.ef) && 'ty' in object && 'ks' in object) {
        this.diagnostics.error(
          'effects',
          'Layer effects are not supported; they are dropped.',
          { path: `${path}/ef` }
        );
        delete object.ef;
      }
    });
    if (Array.isArray(this.json.assets)) {
      this.json.assets = this.json.assets.filter((asset, index) =>
        this.asset(asset, `/assets/${index}`)
      );
    }
  }

  /** Whether to keep an asset; precompositions keep one level of layers. */
  asset(asset, path) {
    if (!isObject(asset) || !Array.isArray(asset.layers)) {
      this.diagnostics.error(
        'unsupported-asset',
        'Image, audio and data assets are not supported; the asset is dropped.',
        { path }
      );
      return false;
    }
    asset.layers = asset.layers.filter((layer, index) => {
      if (isObject(layer) && layer.ty === 0) {
        this.diagnostics.error(
          'nested-precomp',
          'A precomposition inside a precomposition is not supported; the layer is dropped.',
          { path: `${path}/layers/${index}` }
        );
        return false;
      }
      return true;
    });
    this.diagnostics.warning(
      'precomp',
      'A precomposition asset is kept as JSON in extra; its layers are not converted.',
      { path }
    );
    return true;
  }

  layer(json, path) {
    if (!isObject(json)) {
      this.diagnostics.error(
        'invalid-layer',
        'A layer is not an object; it is dropped.',
        {
          path,
        }
      );
      return null;
    }
    const rejected = REJECTED_LAYERS[json.ty];
    if (rejected) {
      this.diagnostics.error(
        'unsupported-layer',
        `${rejected[0].toUpperCase()}${rejected.slice(1)} layers are not supported; the layer is dropped.`,
        { path }
      );
      return null;
    }
    if (json.ty !== 4) {
      this.diagnostics.warning(
        'unsupported-layer',
        `Layers of type ${json.ty} are outside the supported subset; the layer is kept as an opaque element.`,
        { path }
      );
      const { ty, ...rest } = json;
      return element(null, 'opaque', {
        properties: [
          prop('source', FORMAT, `layer-${encodeAny(ty)}`),
          extraProperty(FORMAT, rest),
        ],
      });
    }
    return this.shapeLayer(json, path);
  }

  shapeLayer(json, path) {
    const id = this.ids.fresh(typeof json.nm === 'string' ? json.nm : 'layer');
    const { properties, handled } = mapping.importProperties('layer-4', json);
    handled.add('ty');
    const parts = [...properties];
    const rest = {};
    if (isObject(json.ks)) {
      const ks = this.transform(json.ks, `${path}/ks`);
      parts.push(...ks.properties);
      if (ks.tracks.length > 0) {
        this.animation(id, ks.tracks);
      }
      if (Object.keys(ks.rest).length > 0) {
        rest.ks = ks.rest;
      }
      handled.add('ks');
    }
    if (Array.isArray(json.shapes)) {
      parts.push(
        ...json.shapes.map((s, i) => this.item(s, `${path}/shapes/${i}`))
      );
      handled.add('shapes');
    }
    for (const [key, value] of Object.entries(json)) {
      if (!handled.has(key)) {
        rest[key] = value;
      }
    }
    return element(id, 'shape', {
      properties: [...parts, extraProperty(FORMAT, rest)],
    });
  }

  /**
   * Split a transform (`ks` or a `tr` item) into static properties,
   * animated tracks and the keys kept as JSON.
   */
  transform(ks, path, animate = true) {
    const properties = [];
    const tracks = [];
    const rest = {};
    for (const [key, value] of Object.entries(ks)) {
      const spec = TRANSFORM.find((t) => t.key === key);
      const fixed = spec ? staticValue(value) : undefined;
      const fits =
        spec &&
        (spec.vector ? isVector(fixed) : isNumber(fixed)) &&
        transformRoundTrips(spec, fixed);
      if (fits) {
        properties.push(prop(spec.name, encodeTransform(spec, fixed)));
        continue;
      }
      const track =
        spec && animate && this.plainProperty(value)
          ? this.track(spec, value.k, `${path}/${key}`)
          : null;
      if (track) {
        tracks.push(track);
      } else {
        rest[key] = value;
      }
    }
    return { properties, tracks, rest };
  }

  /** Whether an animated property has no keys but `a`, `k` and `ix`. */
  plainProperty(value) {
    return (
      isAnimated(value) &&
      Object.keys(value).every((k) => PROPERTY_KEYS.includes(k))
    );
  }

  /** `(track <name> (key ...)...)`, or `null` when a keyframe does not fit. */
  track(spec, keyframes, path) {
    const span = this.op - this.ip;
    if (!(span > 0) || keyframes.length === 0) {
      return null;
    }
    const keys = [];
    for (const [index, frame] of keyframes.entries()) {
      const link = this.key(spec, frame, span);
      if (!link) {
        return null;
      }
      if (index < keyframes.length - 1 && !('h' in frame) && !('i' in frame)) {
        this.diagnostics.warning(
          'missing-easing',
          'A keyframe before the last one has no easing; the export gives it linear easing.',
          { path: `${path}/k/${index}` }
        );
      }
      keys.push(link);
    }
    return ['track', spec.name, ...keys];
  }

  /** The offset of a keyframe time, or `null` when it does not read back. */
  offset(t, span) {
    const offset = tidy((t - this.ip) / span);
    return Math.round((this.ip + offset * span) * 1e6) / 1e6 === t
      ? offset
      : null;
  }

  /** `(key <offset> <value> <easing>? (extra ...)?)`, or `null`. */
  key(spec, frame, span) {
    const value = isNumber(frame?.s) ? [frame.s] : frame?.s;
    const fits =
      isObject(frame) &&
      isNumber(frame.t) &&
      isVector(value) &&
      (spec.vector || value.length === 1) &&
      transformRoundTrips(spec, value);
    const offset = fits ? this.offset(frame.t, span) : null;
    if (offset === null) {
      return null;
    }
    const link = [
      'key',
      num(offset),
      encodeTransform(spec, spec.vector ? value : value[0]),
    ];
    const easing = this.easing(frame);
    const kept = easing
      ? KEY_KEYS
      : KEY_KEYS.filter((k) => !EASING_KEYS.includes(k));
    const rest = Object.fromEntries(
      Object.entries(frame).filter(([key]) => !kept.includes(key))
    );
    if (easing) {
      link.push(easing);
    }
    if (Object.keys(rest).length > 0) {
      link.push(['extra', FORMAT, JSON.stringify(rest)]);
    }
    return link;
  }

  /** `(cubic-bezier ox oy ix iy)`, `hold`, or `null`. */
  easing(frame) {
    if (frame.h === 1 && !('i' in frame) && !('o' in frame)) {
      return 'hold';
    }
    if ('h' in frame && frame.h !== 0) {
      return null;
    }
    const { i, o } = frame;
    if (!isObject(i) || !isObject(o)) {
      return null;
    }
    const values = [handle(o.x), handle(o.y), handle(i.x), handle(i.y)];
    const plain =
      values.every((v) => v !== undefined) &&
      Object.keys(i).length === 2 &&
      Object.keys(o).length === 2 &&
      !('h' in frame);
    return plain ? ['cubic-bezier', ...values.map(num)] : null;
  }

  animation(target, tracks) {
    const id = this.ids.fresh(`${target}-animation`);
    const duration = ((this.op - this.ip) / this.json.fr) * 1000;
    this.animations.push(
      element(id, 'animation', {
        properties: [
          prop('source', FORMAT, LOTTIE_VERSION),
          prop('target', target),
          prop('duration', `${tidyNum(duration)}ms`),
          ...tracks.map(([, ...values]) => prop('track', ...values)),
        ],
      })
    );
  }

  /** One shape item as an ordered property of the shape element. */
  item(json, path) {
    const converted = isObject(json) ? this.convertItem(json, path) : null;
    if (converted) {
      return converted;
    }
    this.diagnostics.warning(
      'unsupported-shape',
      `A shape item${isObject(json) ? ` of type "${json.ty}"` : ''} is outside the supported subset; it is kept as JSON.`,
      { path }
    );
    return prop('item', JSON.stringify(json));
  }

  convertItem(json, path) {
    const read = ITEMS[json.ty];
    const result = read ? read.call(this, json, path) : null;
    if (!result) {
      return null;
    }
    const rest = {};
    for (const [key, value] of Object.entries(json)) {
      if (key !== 'ty' && !result.used.includes(key)) {
        rest[key] = value;
      }
    }
    const extra = extraProperty(FORMAT, rest);
    return {
      name: result.name,
      values: [
        ...result.values,
        ...(extra ? [['extra', ...extra.values]] : []),
      ],
    };
  }
}

/** Read static properties of an item: `{ key: [check, encode] }`. */
function statics(json, specs) {
  const values = [];
  const used = [];
  for (const [key, [name, check, encode, required]] of Object.entries(specs)) {
    if (!(key in json)) {
      if (required) {
        return null;
      }
      continue;
    }
    const value = staticValue(json[key]);
    if (value === undefined || !check(value)) {
      return null;
    }
    values.push(name === null ? encode(value) : [name, ...encode(value)]);
    used.push(key);
  }
  return { values, used };
}

const point = (v) => isVector(v) && v.length === 2;
const vector = (v) => v.map(num);
const scalar = (v) => [num(v)];
const percent = (v) => [tidyNum(v / 100)];
const percentFits = (v) => isNumber(v) && tidy(tidy(v / 100) * 100) === v;
const colour = (v) => isVector(v) && (v.length === 3 || v.length === 4);

/** Plain (not animatable) keys of an item, renamed by a values table. */
function named(json, keys) {
  const values = [];
  const used = [];
  for (const [key, name] of keys) {
    if (key in json) {
      const text = isNumber(json[key])
        ? mapping.toLino(name, String(json[key]))
        : null;
      if (text === null || Number(mapping.toJson(name, text)) !== json[key]) {
        return null;
      }
      values.push([name, text]);
      used.push(key);
    }
  }
  return { values, used };
}

function combine(name, ...parts) {
  if (parts.some((p) => p === null)) {
    return null;
  }
  return {
    name,
    values: parts.flatMap((p) => p.values),
    used: parts.flatMap((p) => p.used),
  };
}

const ITEMS = {
  rc(json) {
    return combine(
      'rect',
      statics(json, {
        p: ['at', point, vector, true],
        s: ['size', point, vector, true],
        r: ['radius', isNumber, scalar],
      })
    );
  },
  el(json) {
    return combine(
      'ellipse',
      statics(json, {
        p: ['at', point, vector, true],
        s: ['size', point, vector, true],
      })
    );
  },
  sh(json) {
    const bezier = staticValue(json.ks);
    if (!isObject(bezier)) {
      return null;
    }
    return { name: 'path', values: [encodePath(bezier)], used: ['ks'] };
  },
  fl(json) {
    return combine(
      'fill',
      statics(json, {
        c: [null, colour, (c) => encodeColour(c), true],
        o: ['opacity', percentFits, percent],
      }),
      named(json, [['r', 'fill-rule']])
    );
  },
  st(json) {
    const ml = 'ml' in json ? isNumber(json.ml) : true;
    return ml
      ? combine(
          'stroke',
          statics(json, {
            c: [null, colour, (c) => encodeColour(c), true],
            w: ['width', isNumber, scalar, true],
            o: ['opacity', percentFits, percent],
          }),
          named(json, [
            ['lc', 'cap'],
            ['lj', 'join'],
          ]),
          'ml' in json
            ? { values: [['miter-limit', num(json.ml)]], used: ['ml'] }
            : { values: [], used: [] }
        )
      : null;
  },
  gr(json, path) {
    if (!Array.isArray(json.it)) {
      return null;
    }
    const items = json.it.map((item, i) => this.item(item, `${path}/it/${i}`));
    return {
      name: 'group',
      values: items.map((p) => [p.name, ...p.values]),
      used: ['it'],
    };
  },
  tr(json, path) {
    const keys = Object.fromEntries(
      Object.entries(json).filter(([k]) => TRANSFORM.some((t) => t.key === k))
    );
    const { properties, rest } = this.transform(keys, path, false);
    if (Object.keys(rest).length > 0) {
      return null;
    }
    return {
      name: 'transform',
      values: properties.map((p) => [p.name, ...p.values]),
      used: Object.keys(keys),
    };
  },
};

/**
 * Import a Lottie animation.
 * @param {unknown} json The Lottie JSON.
 * @param {{ style?: 'inline'|'multiline'|'indented' }} [options]
 * @returns {{ lino: string, roots: object[],
 *   diagnostics: import('../../diagnostics.js').Diagnostic[] }}
 */
export function importLottie(json, options = {}) {
  const valid =
    isObject(json) &&
    Array.isArray(json.layers) &&
    isNumber(json.fr) &&
    json.fr > 0 &&
    isNumber(json.ip) &&
    isNumber(json.op);
  const importer = new LottieImporter(valid ? clone(json) : {});
  if (!valid) {
    importer.diagnostics.error(
      'not-lottie',
      'The input is not a Lottie animation (an object with "layers", "fr", "ip" and "op").',
      { path: '' }
    );
    return { lino: '', roots: [], diagnostics: importer.diagnostics.list };
  }
  importer.reject();
  const source = importer.json;
  const id = importer.ids.fresh(
    typeof source.nm === 'string' ? source.nm : 'composition'
  );
  const children = source.layers
    .map((layer, i) => importer.layer(layer, `/layers/${i}`))
    .filter(Boolean);
  const { properties, handled } = mapping.importProperties('animation', source);
  const rest = Object.fromEntries(
    Object.entries(source).filter(
      ([key]) => key !== 'layers' && !handled.has(key)
    )
  );
  const document = element(id, 'document', {
    properties: [
      prop('source', FORMAT, LOTTIE_VERSION),
      ...properties,
      extraProperty(FORMAT, rest),
    ],
    children,
  });
  const roots = [document, ...importer.animations];
  return {
    lino: writeLino(roots, options),
    roots,
    diagnostics: importer.diagnostics.list,
  };
}

/**
 * The Lottie JSON an import and export keep the same: keyframe values are
 * arrays, easing handles with equal components are numbers, and the `ix`
 * keys of animatable properties are dropped.
 * @template T
 * @param {T} json
 * @returns {T}
 */
export function normalizeLottie(json) {
  const out = clone(json);
  walkJson(out, (object) => {
    if ('k' in object && 'a' in object) {
      delete object.ix;
    }
    if (object.a === 1 && Array.isArray(object.k)) {
      object.k.forEach((frame, index) => {
        if (!isObject(frame)) {
          return;
        }
        if (isNumber(frame.s)) {
          frame.s = [frame.s];
        }
        const last = index === object.k.length - 1;
        if (!last && !('h' in frame) && !('i' in frame) && !('o' in frame)) {
          frame.o = { x: 0, y: 0 };
          frame.i = { x: 1, y: 1 };
        }
        collapseEasing(frame);
      });
    }
  });
  return out;
}

/** Easing handles whose components are all equal, as numbers. */
function collapseEasing(frame) {
  const { i, o } = frame;
  const plain =
    isObject(i) &&
    isObject(o) &&
    Object.keys(i).length === 2 &&
    Object.keys(o).length === 2 &&
    [o.x, o.y, i.x, i.y].every((c) => handle(c) !== undefined);
  if (plain) {
    for (const h of [i, o]) {
      h.x = handle(h.x);
      h.y = handle(h.y);
    }
  }
}
