/**
 * Inline `style` attributes -> `(style (padding 8px) (color '#3390ec'))`.
 *
 * The declarations are split by a small character scanner that respects
 * quotes, parentheses and comments (no regular expressions). Values are
 * written as `Link` atoms, so `links-notation` quotes them (`escapeReference`)
 * whenever they contain `#`, `:`, parentheses, whitespace or quotes.
 */

import { Link } from 'links-notation';

const isSpace = (c) =>
  c === ' ' || c === '\t' || c === '\n' || c === '\f' || c === '\r';

/**
 * Walk CSS text, calling `visit(c, top, quoted)` for every character outside
 * comments (a comment is visited as one space); `top` is true outside quotes
 * and parentheses, `quoted` is true inside a quoted string.
 */
function scanCss(text, visit) {
  let quote = null;
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote !== null) {
      if (c === quote) {
        quote = null;
        visit(c, depth === 0, false);
      } else {
        i = visitQuoted(text, i, visit);
      }
    } else if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      i = end === -1 ? text.length : end + 1;
      visit(' ', depth === 0, false);
    } else {
      if (c === '"' || c === "'") {
        quote = c;
      }
      depth = nextDepth(c, depth);
      visit(c, quote === null && depth === 0 && c !== ')', quote !== null);
    }
  }
}

/** Parenthesis depth after `c`. */
const nextDepth = (c, depth) => {
  if (c === '(') {
    return depth + 1;
  }
  return c === ')' && depth > 0 ? depth - 1 : depth;
};

/**
 * Visit the character at `i` inside a string, with the character after it
 * when it is a `\` escape; returns the index of the last visited character.
 */
function visitQuoted(text, i, visit) {
  visit(text[i], false, true);
  if (text[i] === '\\' && i + 1 < text.length) {
    visit(text[i + 1], false, true);
    return i + 1;
  }
  return i;
}

/**
 * Collapse every run of whitespace outside CSS strings into one space and
 * trim the ends; comments become a space.
 * @param {string} text
 */
export function collapseCss(text) {
  let out = '';
  let space = false;
  scanCss(text, (c, _top, quoted) => {
    if (!quoted && isSpace(c)) {
      space = true;
      return;
    }
    out += space && out !== '' ? ` ${c}` : c;
    space = false;
  });
  return out;
}

/**
 * Split an inline style into `[property, value]` declarations. Property
 * names are lower-cased (custom properties `--x` keep their case); empty
 * declarations are skipped.
 * @param {string} text
 * @returns {[string, string][]}
 */
export function parseStyle(text) {
  const parts = [];
  let current = '';
  scanCss(text, (c, top) => {
    if (top && c === ';') {
      parts.push(current);
      current = '';
    } else {
      current += c;
    }
  });
  parts.push(current);
  const declarations = [];
  for (const part of parts) {
    const colon = part.indexOf(':');
    if (colon === -1) {
      continue;
    }
    const raw = part.slice(0, colon).trim();
    const name = raw.startsWith('--') ? raw : raw.toLowerCase();
    const value = collapseCss(part.slice(colon + 1));
    if (name !== '' && value !== '') {
      declarations.push([name, value]);
    }
  }
  return declarations;
}

/**
 * The `(style ...)` link of a list of declarations, or `null` when empty.
 * @param {[string, string][]} declarations
 * @returns {Link | null}
 */
export function styleLink(declarations) {
  if (declarations.length === 0) {
    return null;
  }
  return new Link(null, [
    new Link('style'),
    ...declarations.map(
      ([name, value]) => new Link(null, [new Link(name), new Link(value)])
    ),
  ]);
}
