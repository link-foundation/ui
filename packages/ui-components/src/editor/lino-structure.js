/** Parser-confirmed source ranges. Lexical candidates never establish validity. */
import { Parser } from 'links-notation';
import { highlightLino } from './lino-highlight.js';
import { EDITOR_PARSE_OPTIONS } from './validate-lino.js';

const accepts = (parser, text) => {
  try {
    return parser.parseGroups(text);
  } catch {
    return null;
  }
};

/**
 * The parser currently exposes groups without source ranges. Locate candidate
 * delimiters/indented spans, then ask that same parser whether each is a link.
 * Invalid input yields no structural affordances. No parallel LiNo grammar.
 */
export function linoStructure(text) {
  const parser = new Parser(EDITOR_PARSE_OPTIONS);
  if (!accepts(parser, text)) {
    return { pairs: [], folds: [] };
  }
  const tokens = highlightLino(text);
  const pairs = [];
  const folds = [];
  const opened = [];
  for (const token of tokens.filter((t) => t.type === 'paren')) {
    if (text[token.from] === '(') {
      opened.push(token.from);
      continue;
    }
    const from = opened.pop();
    if (from !== undefined && accepts(parser, text.slice(from, token.to))) {
      pairs.push({ from, to: token.to });
      if (text.slice(from, token.to).includes('\n')) {
        folds.push({ from: from + 1, to: token.from });
      }
    }
  }
  folds.push(...indentedFolds(text, tokens, parser));
  return { pairs, folds };
}

function indentedFolds(text, tokens, parser) {
  const folds = [];
  const lines = [];
  let start = 0;
  let tokenIndex = 0;
  for (const line of text.split('\n')) {
    while (tokenIndex < tokens.length && tokens[tokenIndex].to <= start) {
      tokenIndex++;
    }
    const first = tokens[tokenIndex];
    if (
      first &&
      first.from >= start &&
      first.from < start + line.length &&
      first.type !== 'comment'
    ) {
      lines.push({
        start,
        end: start + line.length,
        indent: first.from - start,
      });
    }
    start += line.length + 1;
  }
  for (let i = 0; i < lines.length; i++) {
    const head = lines[i];
    let end = i + 1;
    while (end < lines.length && lines[end].indent > head.indent) {
      end++;
    }
    if (end === i + 1) {
      continue;
    }
    const last = lines[end - 1];
    const groups = accepts(parser, text.slice(head.start, last.end));
    if (groups?.length === 1 && groups[0].children.length > 0) {
      folds.push({ from: head.end, to: last.end });
    }
  }
  return folds;
}
