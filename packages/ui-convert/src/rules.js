/**
 * A small match / replace rule engine over Links Notation terms, in the shape
 * of the transformer project (https://github.com/link-foundation/transformer):
 *
 *   (mui-button-contained: rule
 *     (match (Button (variant contained) (children $label)))
 *     (replace (button (label $label) (variant filled))))
 *
 * The transformer form `(rule: (name: x) (match: ...) (replace: ...))` is
 * read too. Rules are plain LiNo read with `links-notation`; nothing here
 * parses LiNo by hand.
 *
 * A term is a string (an atom) or an array of terms (a link). An element
 * term is `[Tag, [property, value...]..., ['children', text]?]`: the
 * component name, then one link per literal property.
 *
 * Matching:
 *
 * - an atom `$name` binds a variable (the same name must bind equal terms),
 *   `_` matches anything, any other atom matches itself; an atom with `$`
 *   inside (`space.$n`) is a template: it matches atoms with the same
 *   prefix and suffix and binds the middle;
 * - a link of a pattern matches a link of the same length item by item;
 * - an element pattern (the top-level `match` term) matches by its head and
 *   then each property pattern must match a different property of the
 *   element, in any order (subset match); the element may have more
 *   properties, which the rule does not consume; `(optional (p $v))`
 *   matches a property when the element has one and is skipped otherwise;
 *   `(absent p)` matches only when the element has no property `p`.
 *
 * Replacing substitutes bound variables (also inside atoms: `space.$n`).
 * A top-level property of a `replace` term with an unbound variable is
 * dropped, so optional properties need no extra rules.
 *
 * Rules are tried in order and the first match wins.
 */

import { parseNested } from '@link-foundation/ui-core';

/**
 * @typedef {string | Term[]} Term
 * @typedef {{ name: string, match: Term[], replace: Term[] }} Rule
 * @typedef {Map<string, Term>} Bindings
 */

const VAR = '$';
const WILDCARD = '_';
const OPTIONAL = 'optional';
const ABSENT = 'absent';

/** A `links-notation` link as a term; `(id: a b)` becomes `[id, a, b]`. */
function toTerm(link) {
  if (link.values.length === 0) {
    return link.id;
  }
  const values = link.values.map(toTerm);
  return link.id === null ? values : [link.id, ...values];
}

const sameLink = (a, b) =>
  a.id === b.id &&
  a.values.length === b.values.length &&
  a.values.every((value, i) => sameLink(value, b.values[i]));

/**
 * A rule written over several lines, as `links-notation` returns it: a group
 * `(H (H a) (H b))` whose head `H` is `(name: rule)`, back as one link
 * `(name: rule a b)`. Other links are returned as they are.
 */
function unfold(link) {
  const [head, ...rest] = link.values;
  const grouped =
    link.id === null &&
    head &&
    head.values.length > 0 &&
    rest.length > 0 &&
    rest.every(
      (value) =>
        value.id === null &&
        value.values.length === 2 &&
        sameLink(value.values[0], head)
    );
  if (!grouped) {
    return link;
  }
  return {
    id: head.id,
    values: [...head.values, ...rest.map((value) => value.values[1])],
  };
}

/** The value of a `(key value)` item of a rule link, or `undefined`. */
const field = (items, key) =>
  items.find((item) => Array.isArray(item) && item[0] === key)?.[1];

/**
 * Read a rule from one top-level link, or `null` when it is not a rule.
 * @param {any} link a `links-notation` Link
 * @returns {Rule | null}
 */
function readRule(link) {
  const items = link.values.map(toTerm);
  let name;
  if (items[0] === 'rule' && link.id !== null) {
    name = link.id;
  } else if (link.id === 'rule') {
    name = field(items, 'name');
  } else {
    return null;
  }
  const match = field(items, 'match');
  const replace = field(items, 'replace');
  if (typeof name !== 'string' || !Array.isArray(match) || !replace) {
    throw new Error(`Rule ${name ?? '(unnamed)'}: needs match and replace`);
  }
  return { name, match, replace: Array.isArray(replace) ? replace : [replace] };
}

/**
 * Read the rules of a LiNo rule file. Links that are not rules (a header
 * such as `(mui: mapping ...)`) are skipped.
 * @param {string} text
 * @returns {Rule[]}
 */
export function readRules(text) {
  return parseNested(text)
    .map((link) => readRule(unfold(link)))
    .filter((rule) => rule !== null);
}

const isVar = (atom) => atom.length > 1 && atom.startsWith(VAR);

/** Bind `name` to `value`, or `null` when it is bound to something else. */
function bind(bindings, name, value) {
  const known = bindings.get(name);
  if (known !== undefined) {
    return sameTerm(known, value) ? bindings : null;
  }
  return new Map(bindings).set(name, value);
}

const sameTerm = (a, b) =>
  typeof a === 'string' || typeof b === 'string'
    ? a === b
    : a.length === b.length && a.every((item, i) => sameTerm(item, b[i]));

/**
 * Match an atom with a `$var` inside (`space.$n`): same prefix and
 * suffix (the text after the variable name), the middle is bound.
 */
function matchTemplate(pattern, term, bindings) {
  const at = pattern.indexOf(VAR);
  const prefix = pattern.slice(0, at);
  const rest = pattern.slice(at + 1);
  const length = nameLength(rest);
  const suffix = rest.slice(length);
  if (
    typeof term !== 'string' ||
    term.length <= prefix.length + suffix.length ||
    !term.startsWith(prefix) ||
    !term.endsWith(suffix)
  ) {
    return null;
  }
  const middle = term.slice(prefix.length, term.length - suffix.length);
  return bind(bindings, VAR + rest.slice(0, length), middle);
}

/** The length of a variable name at the start of `text`. */
function nameLength(text) {
  let n = 0;
  while (n < text.length && isNameChar(text[n])) {
    n++;
  }
  return n;
}

const isNameChar = (c) =>
  (c >= 'a' && c <= 'z') ||
  (c >= 'A' && c <= 'Z') ||
  (c >= '0' && c <= '9') ||
  c === '_' ||
  c === '-';

/**
 * Match a pattern term against a term.
 * @param {Term} pattern
 * @param {Term} term
 * @param {Bindings} bindings
 * @returns {Bindings | null}
 */
export function matchTerm(pattern, term, bindings = new Map()) {
  if (typeof pattern === 'string') {
    if (pattern === WILDCARD) {
      return bindings;
    }
    if (isVar(pattern) && nameLength(pattern.slice(1)) === pattern.length - 1) {
      return bind(bindings, pattern, term);
    }
    if (pattern.includes(VAR) && !pattern.startsWith(VAR)) {
      return matchTemplate(pattern, term, bindings);
    }
    return pattern === term ? bindings : null;
  }
  if (!Array.isArray(term) || term.length !== pattern.length) {
    return null;
  }
  let current = bindings;
  for (let i = 0; i < pattern.length && current; i++) {
    current = matchTerm(pattern[i], term[i], current);
  }
  return current;
}

const isOptional = (item) =>
  Array.isArray(item) && item[0] === OPTIONAL && item.length === 2;

const isAbsent = (item) =>
  Array.isArray(item) && item[0] === ABSENT && item.length === 2;

/** Whether an element has a property named `name`. */
const hasProperty = (properties, name) =>
  properties.some((p) => Array.isArray(p) && p[0] === name);

/**
 * Match property patterns against the properties of an element, each
 * against a different property, in any order (with backtracking).
 * @returns {{ bindings: Bindings, used: Set<number> } | null}
 */
function matchProperties(patterns, properties, bindings, used) {
  if (patterns.length === 0) {
    return { bindings, used };
  }
  const [first, ...rest] = patterns;
  const optional = isOptional(first);
  const pattern = optional ? first[1] : first;
  for (let i = 0; i < properties.length; i++) {
    if (used.has(i)) {
      continue;
    }
    const bound = matchTerm(pattern, properties[i], bindings);
    if (bound) {
      const found = matchProperties(
        rest,
        properties,
        bound,
        new Set(used).add(i)
      );
      if (found) {
        return found;
      }
    }
  }
  return optional ? matchProperties(rest, properties, bindings, used) : null;
}

/**
 * Match an element pattern against an element term.
 * @param {Term[]} pattern `[Tag, ...property patterns]`
 * @param {Term[]} element `[Tag, ...properties]`
 * @returns {{ bindings: Bindings, consumed: Term[], rest: Term[] } | null}
 */
export function matchElement(pattern, element) {
  const head = matchTerm(pattern[0], element[0]);
  if (!head) {
    return null;
  }
  const properties = element.slice(1);
  const patterns = pattern.slice(1);
  if (patterns.some((p) => isAbsent(p) && hasProperty(properties, p[1]))) {
    return null;
  }
  const found = matchProperties(
    patterns.filter((p) => !isAbsent(p)),
    properties,
    head,
    new Set()
  );
  if (!found) {
    return null;
  }
  return {
    bindings: found.bindings,
    consumed: properties.filter((_, i) => found.used.has(i)),
    rest: properties.filter((_, i) => !found.used.has(i)),
  };
}

/** Replace `$name` inside an atom; `undefined` when a variable is unbound. */
function substituteAtom(atom, bindings) {
  if (!atom.includes(VAR)) {
    return atom;
  }
  const at = atom.indexOf(VAR);
  const rest = atom.slice(at + 1);
  const length = nameLength(rest);
  if (length === 0) {
    return atom;
  }
  const value = bindings.get(VAR + rest.slice(0, length));
  if (value === undefined) {
    return undefined;
  }
  if (at === 0 && length === rest.length) {
    return value;
  }
  if (typeof value !== 'string') {
    return undefined;
  }
  const tail = substituteAtom(rest.slice(length), bindings);
  return tail === undefined ? undefined : atom.slice(0, at) + value + tail;
}

/**
 * Substitute the variables of a term; `undefined` when one is unbound.
 * @param {Term} term
 * @param {Bindings} bindings
 * @returns {Term | undefined}
 */
export function substitute(term, bindings) {
  if (typeof term === 'string') {
    return substituteAtom(term, bindings);
  }
  const out = [];
  for (const item of term) {
    const value = substitute(item, bindings);
    if (value === undefined) {
      return undefined;
    }
    out.push(value);
  }
  return out;
}

/**
 * Apply the first matching rule to an element term.
 *
 * `node` is the replacement (`[kind, ...items]`, with unbound top-level
 * items dropped), or the unchanged element when no rule matches; `applied`
 * names the rule that was used (empty when none); `consumed` and `rest`
 * split the element's properties into those the rule matched and the others.
 *
 * @param {Term[]} element
 * @param {Rule[]} rules
 * @returns {{ node: Term[], applied: string[], consumed: Term[], rest: Term[] }}
 */
export function applyRules(element, rules) {
  for (const rule of rules) {
    const found = matchElement(rule.match, element);
    if (!found) {
      continue;
    }
    const [head, ...items] = rule.replace;
    const kind = substitute(head, found.bindings);
    if (typeof kind !== 'string') {
      continue;
    }
    return {
      node: [
        kind,
        ...items
          .map((item) => substitute(item, found.bindings))
          .filter((item) => item !== undefined),
      ],
      applied: [rule.name],
      consumed: found.consumed,
      rest: found.rest,
    };
  }
  return { node: element, applied: [], consumed: [], rest: element.slice(1) };
}
