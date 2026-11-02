/**
 * Lottie bezier shapes <-> SVG path data.
 *
 * A Lottie bezier has vertices `v` and tangents `i` (in) and `o` (out)
 * relative to their vertex. The SVG path uses only absolute `M`, `L`, `C`
 * and `Z` commands. A bezier is written as SVG only when the SVG reads back
 * to exactly the same bezier; otherwise it is written as its JSON text.
 * The SVG reader is a small tokenizer: nothing is evaluated.
 */

import { isObject } from '../safety.js';
import { isVector, num, tidy } from './shared.js';

const isZero = (p) => p.every((n) => n === 0);
const add = (a, b) => a.map((n, k) => tidy(n + (b[k] ?? 0)));
const sub = (a, b) => a.map((n, k) => tidy(n - (b[k] ?? 0)));
const point = (p) => p.map(num).join(' ');

/**
 * SVG path data for a bezier (not checked to read back).
 * @param {{ c?: boolean, v: number[][], i: number[][], o: number[][] }} bezier
 */
function writeSvg(bezier) {
  const { v, i, o } = bezier;
  const parts = [`M${point(v[0])}`];
  const segment = (from, to) => {
    if (isZero(o[from]) && isZero(i[to])) {
      return `L${point(v[to])}`;
    }
    const c1 = add(v[from], o[from]);
    const c2 = add(v[to], i[to]);
    return `C${point(c1)} ${point(c2)} ${point(v[to])}`;
  };
  for (let k = 1; k < v.length; k++) {
    parts.push(segment(k - 1, k));
  }
  if (bezier.c) {
    const last = v.length - 1;
    if (!(isZero(o[last]) && isZero(i[0]))) {
      parts.push(segment(last, 0));
    }
    parts.push('Z');
  }
  return parts.join(' ');
}

/** Split SVG path data into commands and numbers. */
function tokenize(text) {
  const tokens = [];
  let current = '';
  const flush = () => {
    if (current !== '') {
      tokens.push(current);
      current = '';
    }
  };
  for (const c of text) {
    if ('MLCZ'.includes(c)) {
      flush();
      tokens.push(c);
    } else if (c === ' ' || c === ',') {
      flush();
    } else if (c === '-' && current !== '' && !current.endsWith('e')) {
      flush();
      current = c;
    } else {
      current += c;
    }
  }
  flush();
  return tokens;
}

/** How many numbers each command reads, and when it may appear. */
const COMMANDS = {
  M: { count: 2, first: true },
  L: { count: 2, first: false },
  C: { count: 6, first: false },
  Z: { count: 0, first: false },
};

/**
 * Apply one command with its numbers to the bezier being built.
 * @param {{ v: number[][], i: number[][], o: number[][] }} b
 * @param {string} command
 * @param {number[]} p
 */
function apply(b, command, p) {
  if (command === 'C') {
    const to = [p[4], p[5]];
    b.o[b.o.length - 1] = sub([p[0], p[1]], b.v.at(-1));
    b.v.push(to);
    b.i.push(sub([p[2], p[3]], to));
    b.o.push([0, 0]);
  } else if (command !== 'Z') {
    b.v.push(p);
    b.i.push([0, 0]);
    b.o.push([0, 0]);
  }
}

/** A curved closing segment ends on the first vertex again: merge them. */
function mergeClose(b) {
  const last = b.v.at(-1);
  if (b.v.length > 1 && last[0] === b.v[0][0] && last[1] === b.v[0][1]) {
    b.v.pop();
    b.i[0] = b.i.pop();
    b.o.pop();
  }
}

/**
 * Read SVG path data written with absolute M, L, C and Z commands back to a
 * Lottie bezier, or `null` when it uses anything else.
 * @param {string} text
 */
export function svgToBezier(text) {
  const tokens = tokenize(text);
  const b = { v: [], i: [], o: [] };
  let closed = false;
  let curved = false;
  let at = 0;
  while (at < tokens.length) {
    const command = tokens[at++];
    const rule = COMMANDS[command];
    if (closed || !rule || rule.first !== (b.v.length === 0)) {
      return null;
    }
    const p = tokens.slice(at, at + rule.count).map(Number);
    at += rule.count;
    if (p.length !== rule.count || !p.every(Number.isFinite)) {
      return null;
    }
    apply(b, command, p);
    closed = command === 'Z';
    curved = command === 'C' || (closed && curved);
  }
  if (b.v.length === 0) {
    return null;
  }
  if (closed && curved) {
    mergeClose(b);
  }
  return { c: closed, i: b.i, o: b.o, v: b.v };
}

/** Whether a value is a 2D Lottie bezier. */
function isBezier(value) {
  if (!isObject(value)) {
    return false;
  }
  const { v, i, o } = value;
  const points = (list) =>
    Array.isArray(list) &&
    list.length === v.length &&
    list.every((p) => isVector(p) && p.length === 2);
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    points(v) &&
    points(i) &&
    points(o) &&
    Object.keys(value).every((k) => ['c', 'v', 'i', 'o'].includes(k)) &&
    (value.c === undefined || typeof value.c === 'boolean')
  );
}

const canonical = (bezier) =>
  JSON.stringify({
    c: bezier.c ?? false,
    i: bezier.i,
    o: bezier.o,
    v: bezier.v,
  });

/**
 * The `(path ...)` text of a bezier: SVG path data when it reads back to
 * the same bezier, otherwise the bezier's JSON text (it starts with `{`).
 * @param {unknown} bezier
 * @returns {string}
 */
export function encodePath(bezier) {
  if (isBezier(bezier) && bezier.c !== undefined) {
    const svg = writeSvg(bezier);
    const back = svgToBezier(svg);
    if (back && canonical(back) === canonical(bezier)) {
      return svg;
    }
  }
  return JSON.stringify(bezier);
}

/**
 * The bezier of a `(path ...)` text, or `null`.
 * @param {unknown} text
 */
export function decodePath(text) {
  if (typeof text !== 'string') {
    return null;
  }
  if (text.startsWith('{')) {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
  return svgToBezier(text);
}
