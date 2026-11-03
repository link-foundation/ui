/** Lexical colouring only. No links, validation or folding are built here. */
import { stripComments, unescapeReference } from 'links-notation';

const space = (char) => char !== undefined && char.trim() === '';
const quote = (char) => char === "'" || char === '"' || char === '`';
const boundary = (char) =>
  char === undefined || space(char) || '():'.includes(char) || quote(char);

/** A quote-run token, including incomplete input while the user types. */
function quotedEnd(text, start) {
  const delimiter = text[start];
  let count = 1;
  while (text[start + count] === delimiter) {
    count++;
  }
  let at = start + count;
  while (at < text.length) {
    if (text[at] !== delimiter) {
      at++;
      continue;
    }
    let run = 1;
    while (text[at + run] === delimiter) {
      run++;
    }
    if (Math.floor(run / count) % 2 === 1) {
      if (count % 2 === 0) {
        try {
          unescapeReference(text.slice(start, at + run));
        } catch {
          return { to: start + count, closed: true };
        }
      }
      return { to: at + run, closed: true };
    }
    at += run;
  }
  return {
    to: count % 2 === 0 ? start + count : text.length,
    closed: count % 2 === 0,
  };
}

/** @param {string} text
 * @returns {{type: 'paren'|'id'|'colon'|'string'|'comment'|'word', from: number, to: number}[]}
 */
export function highlightLino(text) {
  return highlightLinoLine(text).tokens;
}

/** Internal line tokenizer; carries only an unfinished quote delimiter. */
export function highlightLinoLine(line, continuation = '') {
  const text = continuation + line;
  let next = '';
  const clean = stripComments(text);
  const tokens = [];
  let at = 0;
  while (at < text.length) {
    const from = at;
    const char = text[at];
    let type;
    if (char !== clean[at]) {
      at = text.indexOf('\n', at);
      if (at === -1) {
        at = text.length;
      }
      type = 'comment';
    } else if (space(char)) {
      at++;
      continue;
    } else if (quote(char)) {
      const quoted = quotedEnd(text, at);
      at = quoted.to;
      if (!quoted.closed) {
        let end = from + 1;
        while (text[end] === char) {
          end++;
        }
        next = text.slice(from, end);
      }
      type = 'string';
    } else if (char === '(' || char === ')') {
      at++;
      type = 'paren';
    } else if (char === ':') {
      at++;
      type = 'colon';
    } else {
      do {
        at++;
      } while (!boundary(text[at]));
      type = text[at] === ':' ? 'id' : 'word';
    }
    tokens.push({ type, from, to: at });
  }
  return {
    tokens: tokens
      .filter((t) => t.to > continuation.length)
      .map((t) => ({
        ...t,
        from: Math.max(0, t.from - continuation.length),
        to: t.to - continuation.length,
      })),
    continuation: next,
  };
}
