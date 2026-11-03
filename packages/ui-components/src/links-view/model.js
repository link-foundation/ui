/**
 * The model of a `link-view`: which link it draws and how, read from Links
 * Notation with the ui-core parser (never with regular expressions).
 *
 * ```lino
 * (simple: link-view
 *   (link (id 1) (source 1) (target 2))
 *   (markers (source bar) (target arrow))
 *   (blueprint true)
 *   (grid true))
 * ```
 *
 * A link whose source or target is missing or `0` has a free end; a link
 * whose source and target are the same reference is a self-loop.
 */

import { parse } from '@link-foundation/ui-core';
import { DEFAULT_ENDS, getMarker } from './markers.js';

/**
 * @typedef {import('@link-foundation/ui-core').RawValue} RawValue
 * @typedef {object} LinkViewModel
 * @property {string|null} name  the id of the `link-view` element
 * @property {string|null} id  the link id
 * @property {string|null} source  the source reference; `null` = free end
 * @property {string|null} target  the target reference; `null` = free end
 * @property {{source: string, target: string}} ends  marker shapes
 * @property {boolean} blueprint
 * @property {boolean} grid
 * @property {number} bend
 * @property {string|null} label  an explicit accessible name
 * @property {boolean} selfLoop
 * @typedef {{code: string, severity: 'error'|'warning', message: string}}
 *   ModelDiagnostic
 */

/** The marker of a free end when none is given: a cross (nothing there). */
export const FREE_END_MARKER = 'cross';

/** The plain value of a raw value, or `undefined` for a nested link. */
const plain = (value) => (typeof value === 'string' ? value : undefined);

/** `[name, ...values]` of a raw link value; `null` for anything else. */
function entry(value) {
  if (!Array.isArray(value) || typeof value[0] !== 'string') {
    return null;
  }
  return { name: value[0], values: value.slice(1) };
}

/** The sub-links of a raw link, by name (the last one of a name wins). */
function entries(values) {
  const byName = new Map();
  for (const value of values) {
    const e = entry(value);
    if (e !== null) {
      byName.set(e.name, e.values);
    }
  }
  return byName;
}

/** A reference: `0`, empty or missing is a free end (`null`). */
function reference(values) {
  const value = plain(values?.[0]);
  return value === undefined || value === '' || value === '0' ? null : value;
}

function readBoolean(values, name, report) {
  const value = plain(values?.[0]);
  if (value === undefined) {
    return false;
  }
  if (value !== 'true' && value !== 'false') {
    report(
      'invalid-value',
      'warning',
      `(${name} ${value}) is not true or false`
    );
  }
  return value === 'true';
}

function readBend(values, report) {
  const value = plain(values?.[0]);
  if (value === undefined) {
    return 0;
  }
  const bend = Number(value);
  if (value.trim() === '' || !Number.isFinite(bend)) {
    report('invalid-value', 'warning', `(bend ${value}) is not a number`);
    return 0;
  }
  return bend;
}

function readEnds(values, free, report) {
  const markers = entries(values ?? []);
  const ends = {};
  for (const end of ['source', 'target']) {
    const fallback = free[end] ? FREE_END_MARKER : DEFAULT_ENDS[end];
    const shape = plain(markers.get(end)?.[0]);
    if (shape !== undefined && getMarker(shape) === undefined) {
      report(
        'unknown-marker',
        'warning',
        `the ${end} marker "${shape}" is not a marker shape`
      );
    }
    ends[end] =
      shape !== undefined && getMarker(shape) !== undefined ? shape : fallback;
  }
  return ends;
}

/**
 * The model of a `link-view` from its sub-links as raw values (the
 * `unknown` list ui-core gives an element of an unknown kind, or ui-dom
 * gives a kind).
 * @param {readonly RawValue[]} raw
 * @param {{name?: string|null}} [options]
 * @returns {{model: LinkViewModel, diagnostics: ModelDiagnostic[]}}
 */
export function readLinkView(raw, { name = null } = {}) {
  const diagnostics = [];
  const report = (code, severity, message) =>
    diagnostics.push({ code, severity, message });
  const props = entries(raw);
  const link = props.get('link');
  if (link === undefined) {
    report('missing-link', 'warning', 'the link-view has no (link ...)');
  }
  const linkProps = entries(link ?? []);
  const id = reference(linkProps.get('id'));
  const source = reference(linkProps.get('source'));
  const target = reference(linkProps.get('target'));
  const free = { source: source === null, target: target === null };
  const label = plain(props.get('label')?.[0]) ?? null;
  return {
    model: Object.freeze({
      name,
      id,
      source,
      target,
      ends: Object.freeze(readEnds(props.get('markers'), free, report)),
      blueprint: readBoolean(props.get('blueprint'), 'blueprint', report),
      grid: readBoolean(props.get('grid'), 'grid', report),
      bend: readBend(props.get('bend'), report),
      label,
      selfLoop: source !== null && source === target,
    }),
    diagnostics,
  };
}

/**
 * Read the first `link-view` element of a Links Notation text.
 * @param {string} text
 * @returns {{model: LinkViewModel, diagnostics: ModelDiagnostic[]}}
 */
export function parseLinkView(text) {
  const document = parse(text, { checks: false });
  const errors = document.diagnostics
    .filter((d) => d.severity === 'error')
    .map((d) => ({ code: d.code, severity: 'error', message: d.message }));
  const root = document.roots.find((r) => r.kind === 'link-view');
  // An unnamed `(link-view ...)` is kept by ui-core as a raw sub-link.
  const unnamed = document.unknown.find(
    (raw) => Array.isArray(raw) && raw[0] === 'link-view'
  );
  if (root === undefined && unnamed !== undefined) {
    const read = readLinkView(unnamed.slice(1));
    return { model: read.model, diagnostics: [...errors, ...read.diagnostics] };
  }
  if (root === undefined) {
    const { model, diagnostics } = readLinkView([]);
    return {
      model,
      diagnostics: [
        ...errors,
        {
          code: 'missing-link-view',
          severity: 'error',
          message: 'the text has no link-view element',
        },
        ...diagnostics,
      ],
    };
  }
  const read = readLinkView(root.unknown, { name: root.id ?? null });
  return { model: read.model, diagnostics: [...errors, ...read.diagnostics] };
}

/** How an end is announced. */
const endName = (ref) => (ref === null ? 'a free end' : ref);

/**
 * The accessible name of a link view: `Link 1 from 1 to 2`.
 * @param {LinkViewModel} model
 */
export function accessibleName(model) {
  if (model.label !== null) {
    return model.label;
  }
  const head = model.id === null ? 'Link' : `Link ${model.id}`;
  const loop = model.selfLoop ? ', a self-loop' : '';
  return `${head} from ${endName(model.source)} to ${endName(model.target)}${loop}`;
}
