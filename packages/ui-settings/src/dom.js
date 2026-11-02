/**
 * Applying settings to the page: CSS variables and data attributes on the
 * root element, and a before-paint script that does it from storage before
 * the first frame.
 *
 * The before-paint script runs inline in `<head>`, before any module loads,
 * so it cannot carry the Links Notation parser (over 100 KB). It reads a
 * small JSON *paint snapshot* (`paintSnapshot(schema, values)`: the changed
 * values of the fields that are applied to the page) that the app writes
 * next to its values document, and checks every value against the schema
 * rules inlined in the script. Corrupted storage gives the defaults.
 */

import { cssValue, formatValue } from './coerce.js';
import { BUILT_IN_TYPES } from './types.js';
import { diff, merge } from './values.js';

/** @typedef {import('./schema.js').SettingsSchema} SettingsSchema */
/** @typedef {import('./schema.js').SettingField} SettingField */
/** @typedef {import('./values.js').SettingsValues} SettingsValues */

/** The storage key of the paint snapshot. */
export const PAINT_STORAGE_KEY = 'link-ui.settings.paint.v1';

/** `theme-mode` and `data-theme-mode` are both the `data-theme-mode` attribute. */
export const attributeName = (name) =>
  name.startsWith('data-') ? name : `data-${name}`;

const applied = (schema) =>
  [...schema.fields.values()].filter((field) => field.apply.length > 0);

/**
 * Set the CSS variables and data attributes of the values (missing or
 * invalid values: the defaults) on a root element.
 * @param {SettingsSchema} schema
 * @param {SettingsValues} values
 * @param {HTMLElement} [root] default: `document.documentElement`
 */
export function applyToRoot(schema, values, root) {
  const element = root ?? globalThis.document?.documentElement;
  if (!element) {
    throw new TypeError('applyToRoot needs a root element');
  }
  const all = merge(schema, values, undefined).values;
  for (const field of applied(schema)) {
    const value = all[field.key];
    for (const target of field.apply) {
      if (target.cssVar) {
        element.style.setProperty(target.cssVar, cssValue(field, value));
      }
      if (target.dataAttr) {
        element.setAttribute(
          attributeName(target.dataAttr),
          formatValue(field, value).join(' ')
        );
      }
    }
  }
}

/**
 * The paint snapshot of values: JSON of the changed values of the applied
 * fields. Store it under `storageKey` whenever the values change.
 * @param {SettingsSchema} schema
 * @param {SettingsValues} values
 */
export function paintSnapshot(schema, values) {
  const changed = diff(schema, merge(schema, values, undefined).values);
  const out = {};
  for (const field of applied(schema)) {
    if (Object.hasOwn(changed, field.key)) {
      out[field.key] = changed[field.key];
    }
  }
  return JSON.stringify(out);
}

/* eslint-disable complexity -- runs standalone in the browser */
/**
 * The body of the before-paint script. It is serialised with
 * `Function.prototype.toString`, so it must not use anything outside itself.
 * @param {Array<object>} rules
 * @param {string} key
 */
function paintFromStorage(rules, key) {
  let stored = {};
  try {
    const parsed = JSON.parse(globalThis.localStorage.getItem(key) || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      stored = parsed;
    }
  } catch {
    stored = {};
  }
  const decimals = (n) => {
    const text = String(n);
    return text.includes('.') ? text.length - text.indexOf('.') - 1 : 0;
  };
  const number = (rule, raw) => {
    let n = typeof raw === 'number' ? raw : NaN;
    if (!Number.isFinite(n)) {
      return undefined;
    }
    n = Math.min(rule.max ?? n, Math.max(rule.min ?? n, n));
    if (rule.step > 0) {
      const base = rule.min ?? 0;
      const places = Math.max(decimals(rule.step), decimals(base));
      n = Number(
        (base + Math.round((n - base) / rule.step) * rule.step).toFixed(places)
      );
      n = Math.min(rule.max ?? n, Math.max(rule.min ?? n, n));
    }
    return n;
  };
  const check = (rule, raw) => {
    if (rule.t === 'range' || rule.t === 'number') {
      return number(rule, raw);
    }
    if (rule.t === 'toggle') {
      return typeof raw === 'boolean' ? raw : undefined;
    }
    if (rule.t === 'choice') {
      return rule.o.includes(raw) ? raw : undefined;
    }
    if (rule.t === 'color') {
      return typeof raw === 'string' && /^#[0-9a-f]{6}$/i.test(raw)
        ? raw
        : undefined;
    }
    return rule.t === 'text' && typeof raw === 'string' ? raw : undefined;
  };
  const root = globalThis.document.documentElement;
  for (const rule of rules) {
    let value;
    try {
      if (rule.t && Object.prototype.hasOwnProperty.call(stored, rule.k)) {
        value = check(rule, stored[rule.k]);
      }
    } catch {
      value = undefined;
    }
    for (const [kind, name, fixed] of rule.a) {
      const numeric = rule.t === 'range' || rule.t === 'number';
      let text = fixed;
      if (value !== undefined) {
        text = String(value) + (kind === 'css' && numeric ? rule.u || '' : '');
      }
      if (kind === 'css') {
        root.style.setProperty(name, text);
      } else {
        root.setAttribute(name, text);
      }
    }
  }
}
/* eslint-enable complexity */

/** The rules the script needs: one per applied field. */
function paintRules(schema) {
  return applied(schema).map((field) => {
    const builtIn = BUILT_IN_TYPES.includes(field.type);
    const rule = {
      k: field.key,
      // A custom type is not checked in the script: it gets its default.
      t: builtIn ? field.type : '',
      a: field.apply.map((target) =>
        target.cssVar
          ? ['css', target.cssVar, cssValue(field, field.default)]
          : [
              'attr',
              attributeName(target.dataAttr),
              formatValue(field, field.default).join(' '),
            ]
      ),
    };
    for (const [name, value] of [
      ['min', field.min],
      ['max', field.max],
      ['step', field.step],
      ['u', field.unit],
      ['o', field.options],
    ]) {
      if (value !== undefined) {
        rule[name] = value;
      }
    }
    return rule;
  });
}

/** JSON that is safe inside an inline `<script>`. */
const inlineJson = (value) =>
  JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll(' ', '\\u2028')
    .replaceAll(' ', '\\u2029');

/**
 * The before-paint script: put it inline at the top of `<head>`. It applies
 * the stored paint snapshot (or the defaults) to `<html>` and never throws.
 * @param {SettingsSchema} schema
 * @param {{ storageKey?: string }} [options]
 * @returns {string}
 */
export function beforePaintScript(
  schema,
  { storageKey = PAINT_STORAGE_KEY } = {}
) {
  const rules = inlineJson(paintRules(schema));
  const key = inlineJson(String(storageKey));
  return `(function(){try{(${paintFromStorage.toString()})(${rules},${key});}catch(e){}})();`;
}

/**
 * The CSP hash of the before-paint script (`'sha256-…'` without quotes), for
 * `Content-Security-Policy: script-src 'sha256-…'`.
 * @param {SettingsSchema|string} schemaOrScript a schema or the script text
 * @param {{ storageKey?: string }} [options]
 * @returns {Promise<string>}
 */
export async function beforePaintScriptHash(schemaOrScript, options) {
  const script =
    typeof schemaOrScript === 'string'
      ? schemaOrScript
      : beforePaintScript(schemaOrScript, options);
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('beforePaintScriptHash needs Web Crypto (crypto.subtle)');
  }
  const digest = await subtle.digest(
    'SHA-256',
    new globalThis.TextEncoder().encode(script)
  );
  let binary = '';
  for (const byte of new Uint8Array(digest)) {
    binary += String.fromCharCode(byte);
  }
  return `sha256-${globalThis.btoa(binary)}`;
}
