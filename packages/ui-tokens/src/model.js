/**
 * `readTokens(text)`: token sets written in Links Notation.
 *
 * ```lino
 * (material3: theme
 *   (extends base)
 *   (token color.primary '#6750A4' (description 'Brand colour'))
 *   (token color.action (token color.primary))
 *   (token font.body Roboto Arial sans-serif)
 *   (token weight.strong 600 (type fontWeight))
 *   (mode dark
 *     (token color.primary '#D0BCFF')))
 * ```
 *
 * The text is read by ui-core `parse` (the official `links-notation`
 * parser plus path folding), so the one-line, multi-line and indented forms
 * all give the same sets. A set is a `theme` element of the ui-dialect
 * vocabulary; `mode` is added to its properties here.
 */

import { defaultVocabulary, parse } from '@link-foundation/ui-core';
import { tokenDiagnostic } from './diagnostics.js';
import { TOKEN_TYPES, typeTokenValue } from './values.js';

/**
 * @typedef {import('./types.js').Token} Token
 * @typedef {import('./types.js').TokenSet} TokenSet
 * @typedef {import('./types.js').Diagnostic} Diagnostic
 */

let vocabulary;

/** The ui-dialect vocabulary with `(property mode any multi)` on `theme`. */
function tokensVocabulary() {
  if (vocabulary === undefined) {
    const base = defaultVocabulary();
    const theme = base.kinds.get('theme');
    const properties = new Map(theme.properties).set('mode', {
      type: 'any',
      multi: true,
    });
    vocabulary = {
      ...base,
      kinds: new Map(base.kinds).set('theme', { ...theme, properties }),
      multiValued: new Set([...base.multiValued, 'mode']),
    };
  }
  return vocabulary;
}

const META = new Set(['description', 'type']);
const isMeta = (raw) =>
  Array.isArray(raw) &&
  META.has(raw[0]) &&
  raw.length === 2 &&
  typeof raw[1] === 'string';

/**
 * Whether `path` can name a token: dot-separated, non-empty segments that
 * do not start with `$` and contain no `{`, `}` or white space (DTCG
 * 2025.10 section 5.1.1 "Character restrictions").
 */
export const isTokenPath = (path) =>
  typeof path === 'string' &&
  path
    .split('.')
    .every(
      (part) =>
        part.length > 0 && !part.startsWith('$') && !/[{}\s]/u.test(part)
    );

/**
 * Read one `(token PATH VALUE... (description '...') (type T))` link given
 * as its values after `token`.
 * @returns {Token|null}
 */
function readToken(values, at, diagnostics) {
  const [path, ...rest] = values;
  if (!isTokenPath(path)) {
    diagnostics.push(tokenDiagnostic('invalid-token', 'error', at));
    return null;
  }
  const where = { ...at, token: path };
  const meta = Object.fromEntries(rest.filter(isMeta));
  const parts = rest.filter((raw) => !isMeta(raw));
  if (parts.length === 0) {
    diagnostics.push(tokenDiagnostic('invalid-token', 'error', where));
    return null;
  }
  if (meta.type !== undefined && !TOKEN_TYPES.includes(meta.type)) {
    diagnostics.push(
      tokenDiagnostic('unknown-type', 'error', { ...where, type: meta.type })
    );
    return null;
  }
  // Several values are one list: `(token font.body Roboto Arial sans-serif)`.
  const raw = parts.length === 1 ? parts[0] : parts;
  const value = typeTokenValue(raw, meta.type);
  if (value === null) {
    diagnostics.push(
      tokenDiagnostic('invalid-value', 'error', {
        ...where,
        ...(meta.type === undefined ? {} : { type: meta.type }),
      })
    );
    return null;
  }
  const token = {
    path,
    type: meta.type ?? (value.type === 'token-ref' ? null : value.type),
    value,
  };
  if (meta.description !== undefined) {
    token.description = meta.description;
  }
  if (at.mode !== undefined) {
    token.mode = at.mode;
  }
  return token;
}

/** Add a token to a list, replacing (with a warning) an earlier one. */
function addToken(list, token, at, diagnostics) {
  const i = list.findIndex((t) => t.path === token.path);
  if (i === -1) {
    list.push(token);
    return;
  }
  diagnostics.push(
    tokenDiagnostic('duplicate-token', 'warning', { ...at, token: token.path })
  );
  list[i] = token;
}

const isTokenLink = (raw) =>
  Array.isArray(raw) && raw[0] === 'token' && raw.length > 1;

function readMode(set, values, diagnostics) {
  const [name, ...links] = values;
  if (typeof name !== 'string') {
    diagnostics.push(tokenDiagnostic('invalid-mode', 'error', { set: set.id }));
    return;
  }
  const at = { set: set.id, mode: name };
  set.modes[name] ??= [];
  for (const link of links) {
    if (!isTokenLink(link)) {
      diagnostics.push(tokenDiagnostic('invalid-token', 'error', at));
      continue;
    }
    const token = readToken(link.slice(1), at, diagnostics);
    if (token !== null) {
      addToken(set.modes[name], token, at, diagnostics);
    }
  }
}

function readSet(node, diagnostics) {
  /** @type {TokenSet} */
  // `modes` has no prototype, so that a mode named `__proto__` is a mode.
  const set = {
    id: node.id,
    extends: [],
    tokens: [],
    modes: Object.create(null),
  };
  for (const property of node.properties) {
    if (property.name === 'extends') {
      set.extends.push(...property.values.filter((v) => typeof v === 'string'));
    } else if (property.name === 'token') {
      const at = { set: set.id };
      const token = readToken(property.values, at, diagnostics);
      if (token !== null) {
        addToken(set.tokens, token, at, diagnostics);
      }
    } else if (property.name === 'mode') {
      readMode(set, property.values, diagnostics);
    }
  }
  return set;
}

/**
 * Read every token set (every `theme` element) of a Links Notation text.
 * Never throws: problems are diagnostics (`syntax-error`, `invalid-token`,
 * `invalid-value`, `unknown-type`, `duplicate-token`, ...).
 * @param {string} text
 * @returns {{ sets: Map<string, TokenSet>, diagnostics: Diagnostic[] }}
 */
export function readTokens(text) {
  const doc = parse(text, { checks: false, vocabulary: tokensVocabulary() });
  const diagnostics = [...doc.diagnostics];
  const sets = new Map();
  for (const node of doc.roots) {
    if (node.kind !== 'theme') {
      continue;
    }
    if (node.id === null) {
      diagnostics.push(tokenDiagnostic('anonymous-set', 'error', {}));
      continue;
    }
    if (!sets.has(node.id)) {
      sets.set(node.id, readSet(node, diagnostics));
    }
  }
  return { sets, diagnostics };
}
