/** Deliberately bounded CSS geometry grammar. No URLs, strings, escapes,
 * comments, declarations or unrecognised functions can reach CSS output. */
export function validClipPath(text) {
  if (typeof text !== 'string' || text.length > 131072) {
    return false;
  }
  if (/^inset\([0-9.]+px(?: round [0-9.]+px)?\)$/u.test(text)) {
    return true;
  }
  if (!text.startsWith('polygon(') || !text.endsWith(')')) {
    return false;
  }
  const source = text.slice(8, -1);
  let offset = 0;
  let depth = 0;
  const space = () => {
    while (/\s/u.test(source[offset] ?? '') && offset < source.length) {
      offset++;
    }
  };
  function term() {
    space();
    if (++depth > 24) {
      return false;
    }
    let ok = false;
    if (source.startsWith('calc(', offset)) {
      offset += 5;
      ok = expression();
      space();
      ok = ok && source[offset++] === ')';
    } else if (source.startsWith('var(', offset)) {
      offset += 4;
      space();
      const match = /^--[a-zA-Z_][\w-]*/u.exec(source.slice(offset));
      if (match) {
        offset += match[0].length;
        space();
        if (source[offset] === ',') {
          offset++;
          ok = term();
        } else {
          ok = true;
        }
        space();
        ok = ok && source[offset++] === ')';
      }
    } else {
      const match = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:px|%|cqw|cqh)?/u.exec(
        source.slice(offset)
      );
      if (match) {
        offset += match[0].length;
        ok = true;
      }
    }
    depth--;
    return ok;
  }
  function expression() {
    if (!term()) {
      return false;
    }
    space();
    let count = 0;
    while (['+', '-', '*', '/'].includes(source[offset])) {
      if (++count > 256) {
        return false;
      }
      offset++;
      if (!term()) {
        return false;
      }
      space();
    }
    return true;
  }
  let points = 0;
  while (offset < source.length) {
    if (!term()) {
      return false;
    }
    const before = offset;
    space();
    if (offset === before || !term()) {
      return false;
    }
    points++;
    space();
    if (offset === source.length) {
      return points >= 3 && points <= 512;
    }
    if (source[offset++] !== ',' || points > 512) {
      return false;
    }
  }
  return false;
}
