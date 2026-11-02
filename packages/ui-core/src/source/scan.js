/**
 * `scanDelimiters(stripped)`: where the delimiters of a Links Notation text
 * are. This is a stopgap until `links-notation` reports source positions
 * (see the README): when it does, `index.js` uses them and this file goes.
 *
 * The scanner does not decide any structure. It only finds the parentheses,
 * the colons, the references (bare or quoted), the line breaks and the
 * indentation of every line, walking the text one character at a time. Every
 * span built from these tokens is cross-checked against the official parser
 * by `indexSource`.
 *
 * The input is the output of `stripComments(text)`: comments are blanked
 * with spaces, so every offset is also an offset of the original text.
 */

/** The characters a reference can be written between. */
export const QUOTES = ['"', "'", '`'];

const isBreak = (c) => c === '\n' || c === '\r';
const isBlank = (c) => c === ' ' || c === '\t';
/** Characters that end a bare reference (the grammar's `referenceSymbol`). */
const endsBare = (c) => isBlank(c) || isBreak(c) || c === '(' || c === ')';

/** The number of `quote` characters in a row from `start`. */
function runLength(text, start, quote) {
  let end = start;
  while (end < text.length && text[end] === quote) {
    end++;
  }
  return end - start;
}

/**
 * Whether a body between an even run of delimiters is substantive: it has a
 * visible character and does not straddle a parenthesis (the grammar's
 * `isSubstantiveBody`).
 */
function isSubstantive(text, from, to) {
  let depth = 0;
  let visible = false;
  for (let i = from; i < to; i++) {
    const c = text[i];
    if (c === '(') {
      depth++;
    } else if (c === ')') {
      depth--;
      if (depth < 0) {
        return false;
      }
    }
    if (!isBlank(c) && !isBreak(c)) {
      visible = true;
    }
  }
  return visible && depth === 0;
}

/**
 * The position just past the quoted reference opened at `start`, or `null`
 * when nothing opens there. A run of N delimiters closes at the next run of
 * R >= N delimiters with `Math.floor(R / N)` odd (a run of 2N is an escaped
 * delimiter); an even opening run that encloses nothing substantive is the
 * empty reference. This is the rule of the `links-notation` grammar.
 * @param {string} text
 * @param {number} start
 * @returns {number|null}
 */
export function quotedEnd(text, start) {
  const quote = text[start];
  if (!QUOTES.includes(quote)) {
    return null;
  }
  const count = runLength(text, start, quote);
  const empty = count % 2 === 0 ? start + count : null;
  let position = start + count;
  while (position < text.length) {
    if (text[position] !== quote) {
      position++;
      continue;
    }
    const length = runLength(text, position, quote);
    if (length >= count && Math.floor(length / count) % 2 === 1) {
      const end = position + length;
      // The closing run's last `count` delimiters close the reference.
      const body = end - count;
      if (empty !== null && !isSubstantive(text, start + count, body)) {
        return empty;
      }
      return end;
    }
    position += length;
  }
  return empty;
}

/** The reference token (quoted or bare) that starts at `start`. */
function readReference(text, start) {
  const end = QUOTES.includes(text[start]) ? quotedEnd(text, start) : null;
  if (end !== null) {
    return { type: 'reference', start, end, quoted: true };
  }
  let bare = start;
  while (bare < text.length && !endsBare(text[bare]) && text[bare] !== ':') {
    bare++;
  }
  return { type: 'reference', start, end: bare, quoted: false };
}

/**
 * @typedef {object} Token
 * @property {'open'|'close'|'colon'|'reference'|'break'} type
 * @property {number} start
 * @property {number} end
 * @property {boolean} [quoted]   references only
 * @property {number} [indent]    breaks only: spaces at the start of the next line
 */

/**
 * @typedef {object} Scan
 * @property {Token[]} tokens
 * @property {number[]} lineStarts  offset of every line (outside quotes)
 * @property {number[]} indents     spaces at the start of every line
 */

/**
 * Scan the delimiters of a text whose comments are blanked.
 * @param {string} stripped `stripComments(text)`
 * @returns {Scan}
 */
export function scanDelimiters(stripped) {
  /** @type {Token[]} */
  const tokens = [];
  const lineStarts = [0];
  const indents = [runLength(stripped, 0, ' ')];
  let i = 0;
  while (i < stripped.length) {
    const c = stripped[i];
    if (isBlank(c)) {
      i++;
    } else if (isBreak(c)) {
      const start = i;
      i += c === '\r' && stripped[i + 1] === '\n' ? 2 : 1;
      const indent = runLength(stripped, i, ' ');
      lineStarts.push(i);
      indents.push(indent);
      tokens.push({ type: 'break', start, end: i, indent });
    } else if (c === '(' || c === ')' || c === ':') {
      const type = c === '(' ? 'open' : c === ')' ? 'close' : 'colon';
      tokens.push({ type, start: i, end: i + 1 });
      i++;
    } else {
      const token = readReference(stripped, i);
      tokens.push(token);
      i = token.end;
    }
  }
  return { tokens, lineStarts, indents };
}
