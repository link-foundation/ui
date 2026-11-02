/**
 * `resolveTokens(sets, setId, { mode })`: the tokens one set gives after
 * inheritance, modes and aliases.
 *
 * 1. `extends`: the chain is every set the set extends, depth first, in the
 *    order written, then the set itself; a later set overrides an earlier
 *    one, so the set's own tokens win and of two parents the later wins.
 * 2. Modes: within each set of the chain, the tokens of `(mode NAME ...)`
 *    override the set's own tokens; a child's plain token still overrides a
 *    parent's mode token.
 * 3. Aliases: `(token a.b)` (the whole value, a composite field or a shadow
 *    layer) is replaced by the resolved value of `a.b`.
 *
 * Problems are diagnostics, never exceptions: `unknown-set`,
 * `extends-cycle`, `unknown-mode`, `unknown-alias`, `alias-cycle` and
 * `type-mismatch`. A token whose alias cannot be resolved is left out.
 */

import { tokenDiagnostic } from './diagnostics.js';
import { mapNestedAliases } from './values.js';

/**
 * @typedef {import('./types.js').TokenSet} TokenSet
 * @typedef {import('./types.js').Token} Token
 * @typedef {import('./types.js').ResolvedToken} ResolvedToken
 * @typedef {import('./types.js').ResolvedTokens} ResolvedTokens
 */

/** The sets of the `extends` chain of `setId`, parents first. */
function chainOf(sets, setId, diagnostics) {
  const chain = [];
  const done = new Set();
  const visit = (id, stack, from) => {
    if (stack.includes(id)) {
      diagnostics.push(
        tokenDiagnostic('extends-cycle', 'error', {
          set: id,
          cycle: [...stack.slice(stack.indexOf(id)), id],
        })
      );
      return;
    }
    if (done.has(id)) {
      return;
    }
    const set = sets.get(id);
    if (set === undefined) {
      diagnostics.push(
        tokenDiagnostic(
          'unknown-set',
          from === undefined ? 'error' : 'warning',
          { ...(from === undefined ? {} : { set: from }), target: id }
        )
      );
      return;
    }
    for (const parent of set.extends) {
      visit(parent, [...stack, id], id);
    }
    done.add(id);
    chain.push(set);
  };
  visit(setId, [], undefined);
  return chain;
}

/** The definitions of every path along the chain for one mode. */
function definitions(chain, mode) {
  /** @type {Map<string, { token: Token, set: string }>} */
  const defs = new Map();
  for (const set of chain) {
    const layers = [set.tokens, mode === null ? [] : (set.modes[mode] ?? [])];
    for (const token of layers.flat()) {
      defs.set(token.path, { token, set: set.id });
    }
  }
  return defs;
}

/** Resolve every definition; `null` marks a token that failed. */
function resolveAll(defs, diagnostics) {
  const results = new Map();
  const where = (def) => ({
    set: def.set,
    token: def.token.path,
    ...(def.token.mode === undefined ? {} : { mode: def.token.mode }),
  });

  const resolveRef = (def, ref, expected, stack) => {
    const target = defs.get(ref.path);
    if (target === undefined) {
      diagnostics.push(
        tokenDiagnostic('unknown-alias', 'error', {
          ...where(def),
          target: ref.path,
        })
      );
      return null;
    }
    if (stack.includes(ref.path)) {
      // The ring of tokens, written from the token reported: b -> a -> b.
      const ring = stack.slice(stack.indexOf(ref.path));
      const start = Math.max(0, ring.indexOf(def.token.path));
      const from = [...ring.slice(start), ...ring.slice(0, start)];
      const cycle = [...from, from[0]];
      diagnostics.push(
        tokenDiagnostic('alias-cycle', 'error', { ...where(def), cycle })
      );
      for (const path of cycle) {
        results.set(path, null);
      }
      return null;
    }
    const resolved = resolveOne(ref.path, stack);
    if (resolved === null) {
      return null;
    }
    if (expected !== null && resolved.type !== expected) {
      diagnostics.push(
        tokenDiagnostic('type-mismatch', 'error', {
          ...where(def),
          target: ref.path,
          expected,
          actual: resolved.type,
        })
      );
      return null;
    }
    return resolved;
  };

  const resolveOne = (path, stack = []) => {
    if (results.has(path)) {
      return results.get(path);
    }
    const def = defs.get(path);
    const { token } = def;
    const inner = [...stack, path];
    let result = null;
    if (token.value.type === 'token-ref') {
      const target = resolveRef(def, token.value, token.type, inner);
      if (target !== null) {
        result = {
          type: target.type,
          value: target.value,
          alias: token.value.path,
        };
      }
    } else {
      let failed = false;
      const value = mapNestedAliases(token.value, (ref, type) => {
        const target = resolveRef(def, ref, type, inner);
        failed ||= target === null;
        return target?.value ?? ref;
      });
      result = failed ? null : { type: token.type, value };
    }
    if (results.get(path) === null) {
      return null; // a cycle through this token was found meanwhile
    }
    const resolved =
      result === null
        ? null
        : {
            path,
            type: result.type,
            value: result.value,
            raw: token.value,
            ...(result.alias === undefined ? {} : { alias: result.alias }),
            ...(token.description === undefined
              ? {}
              : { description: token.description }),
            set: def.set,
            ...(token.mode === undefined ? {} : { mode: token.mode }),
          };
    results.set(path, resolved);
    return resolved;
  };

  const out = new Map();
  for (const path of defs.keys()) {
    const resolved = resolveOne(path);
    if (resolved !== null) {
      out.set(path, resolved);
    }
  }
  return out;
}

/** What makes two resolutions of a token differ (for mode overrides). */
const signature = (t) =>
  JSON.stringify([t.type, t.value, t.alias ?? null, t.raw]);

/** Diagnostics without repeats (each mode resolves the shared tokens). */
const unique = (diagnostics) => [
  ...new Map(
    diagnostics.map((d) => [JSON.stringify([d.code, d.at]), d])
  ).values(),
];

/**
 * Resolve the tokens of one set.
 * @param {Map<string, TokenSet>} sets  as returned by `readTokens`
 * @param {string} setId
 * @param {{ mode?: string|null }} [options]
 * @returns {ResolvedTokens} `Map<path, ResolvedToken>` with `setId`,
 *   `mode`, `diagnostics` and `modes`: for every other mode of the chain,
 *   the tokens that resolve differently in it (or exist only in it)
 */
export function resolveTokens(sets, setId, { mode = null } = {}) {
  const diagnostics = [];
  const chain = chainOf(sets, setId, diagnostics);
  const modeNames = [
    ...new Set(chain.flatMap((set) => Object.keys(set.modes))),
  ];
  if (mode !== null && !modeNames.includes(mode)) {
    diagnostics.push(
      tokenDiagnostic('unknown-mode', 'warning', { set: setId, mode })
    );
  }
  const resolved = resolveAll(definitions(chain, mode), diagnostics);
  const modes = new Map();
  for (const name of modeNames.filter((m) => m !== mode)) {
    const other = resolveAll(definitions(chain, name), diagnostics);
    const changed = new Map(
      [...other].filter(
        ([path, token]) =>
          !resolved.has(path) ||
          signature(resolved.get(path)) !== signature(token)
      )
    );
    modes.set(name, changed);
  }
  return Object.assign(resolved, {
    setId,
    mode,
    modes,
    diagnostics: unique(diagnostics),
  });
}
