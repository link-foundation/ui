/**
 * Test helpers: catch settings that nothing reads.
 */

import { attributeName } from './dom.js';

/** @typedef {import('./schema.js').SettingsSchema} SettingsSchema */
/** @typedef {import('./schema.js').SettingField} SettingField */

const NAME_CHAR = /[\w.-]/;

/** Whether `name` appears in `text` as a whole name (not `--accent-2`). */
function mentions(text, name) {
  let from = text.indexOf(name);
  while (from !== -1) {
    const before = text[from - 1] ?? '';
    const after = text[from + name.length] ?? '';
    const startOk = name.startsWith('-')
      ? before !== '-'
      : !NAME_CHAR.test(before);
    if (startOk && !NAME_CHAR.test(after)) {
      return true;
    }
    from = text.indexOf(name, from + 1);
  }
  return false;
}

const joined = (value) =>
  (Array.isArray(value) ? value : [value ?? '']).map(String).join('\n');

/** Why a field is unused, or `null`. */
function unusedReason(field, css, sources) {
  const all = `${css}\n${sources}`;
  for (const target of field.apply) {
    if (target.cssVar && !mentions(all, target.cssVar)) {
      return `the CSS variable ${target.cssVar} is never read`;
    }
    if (target.dataAttr && !mentions(all, attributeName(target.dataAttr))) {
      return `the attribute ${attributeName(target.dataAttr)} is never read`;
    }
  }
  if (field.apply.length === 0 && !mentions(sources, field.key)) {
    return `no source mentions "${field.key}"`;
  }
  return null;
}

/**
 * Throw when a setting does nothing: a field applied as a CSS variable or a
 * data attribute that no stylesheet (or source) reads, or a field without
 * `apply` that no source file mentions.
 * @param {SettingsSchema} schema
 * @param {{ css?: string|string[], sources?: string|string[] }} files the
 *   text of the stylesheets and of the source files
 */
export function assertEverySettingUsed(schema, { css, sources } = {}) {
  const cssText = joined(css);
  const sourceText = joined(sources);
  const unused = [];
  for (const field of schema.fields.values()) {
    const reason = unusedReason(field, cssText, sourceText);
    if (reason) {
      unused.push({ key: field.key, reason });
    }
  }
  if (unused.length > 0) {
    const error = new Error(
      `Unused settings:\n${unused.map((u) => `- ${u.key}: ${u.reason}`).join('\n')}`
    );
    error.unused = unused.map((u) => u.key);
    throw error;
  }
}
