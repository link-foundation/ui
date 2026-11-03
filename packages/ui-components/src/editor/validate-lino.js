/** Syntax diagnostics from the official LiNo parser; positions are one based. */
import { Parser } from 'links-notation';

export const EDITOR_PARSE_OPTIONS = Object.freeze({
  maxDepth: 64,
  maxInputSize: 1024 * 1024,
});

/** @param {string} text
 * @returns {{ok: boolean, diagnostics: {line: number, column: number, message: string, severity: 'error'|'warning'}[]}}
 */
export function validateLino(text) {
  try {
    new Parser(EDITOR_PARSE_OPTIONS).parseGroups(text);
    return { ok: true, diagnostics: [] };
  } catch (error) {
    return {
      ok: false,
      diagnostics: [
        {
          line: error.line ?? 1,
          column: error.column ?? 1,
          message: error.message,
          severity: 'error',
        },
      ],
    };
  }
}

/** Convert the parser's position to a clamped UTF-16 editor offset. */
export function diagnosticOffset(text, { line, column }) {
  let start = 0;
  for (let n = 1; n < line; n++) {
    const end = text.indexOf('\n', start);
    if (end === -1) {
      return text.length;
    }
    start = end + 1;
  }
  const end = text.indexOf('\n', start);
  return Math.min(end === -1 ? text.length : end, start + column - 1);
}
