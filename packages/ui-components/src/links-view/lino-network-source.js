/** Source annotations only: structure always comes from the official parser. */
import { Link, stripComments } from 'links-notation';
import { formatLinks } from '@link-foundation/ui-core';
import { scanDelimiters } from '@link-foundation/ui-core/source';

/** Locate references in parser traversal order; comments keep their offsets. */
export function sourceReferences(text) {
  const { tokens } = scanDelimiters(stripComments(text));
  return tokens.flatMap((token, index) =>
    token.type === 'reference'
      ? [{ ...token, definition: tokens[index + 1]?.type === 'colon' }]
      : []
  );
}

/** Locate physical lines, including breaks inside quoted values, in one pass. */
function positionLocator(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\r') {
      if (text[i + 1] === '\n') {
        i++;
      }
      starts.push(i + 1);
    } else if (text[i] === '\n') {
      starts.push(i + 1);
    }
  }
  return (offset) => {
    let low = 0;
    let high = starts.length;
    while (low + 1 < high) {
      const middle = Math.floor((low + high) / 2);
      if (starts[middle] <= offset) {
        low = middle;
      } else {
        high = middle;
      }
    }
    return { line: low + 1, column: offset - starts[low] + 1 };
  };
}

/** Attach lexical quoting and positions without interpreting LiNo structure. */
export function annotateLinks(links, text) {
  const references = sourceReferences(text);
  const tokens = scanDelimiters(stripComments(text)).tokens.filter(
    (token) => token.type !== 'break'
  );
  const empty = tokens.filter(
    (token, i) => token.type === 'open' && tokens[i + 1]?.type === 'close'
  );
  const position = positionLocator(text);
  let emptyIndex = 0;
  let index = 0;
  const positions = new WeakMap();
  const visit = (link) => {
    const token = references[index];
    const node = { id: link.id, values: [] };
    const offset =
      link.id === null && link.values.length === 0
        ? empty[emptyIndex++]?.start
        : token?.start;
    positions.set(node, position(offset ?? text.length));
    if (link.id !== null) {
      index++;
      if (token?.definition) {
        node.definition = true;
      } else if (
        token?.quoted ||
        text.slice(token?.start, token?.end) !== link.id
      ) {
        node.quote = text.slice(token.start, token.end);
      }
    }
    node.values = link.values.map(visit);
    return node;
  };
  return { roots: links.map(visit), positions };
}

/** Write nested LiNo with ui-core, retaining value quoting the parser discards. */
export function formatNetworkRoots(roots) {
  const references = [];
  const toLink = (node) => {
    if (node.id === null && node.values.length === 0) {
      references.push({ empty: true }, { placeholder: true });
      return new Link('@empty', [new Link('@empty-value')]);
    }
    if (node.id !== null) {
      references.push(node);
    }
    return new Link(node.id, node.values.map(toLink));
  };
  const text = formatLinks(roots.map(toLink));
  const tokens = sourceReferences(text);
  const chunks = [];
  let cursor = 0;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const node = references[i];
    if (node.empty) {
      let start = token.start;
      let end = tokens[++i].end;
      if (text[start - 1] === '(' && text[end] === ')') {
        start--;
        end++;
      }
      chunks.push(text.slice(cursor, start), '()');
      cursor = end;
      continue;
    }
    let replacement = node.quote ?? text.slice(token.start, token.end);
    if (node.definition && !node.values.length && !token.definition) {
      replacement = `(${replacement}:)`;
    }
    chunks.push(text.slice(cursor, token.start), replacement);
    cursor = token.end;
  }
  chunks.push(text.slice(cursor));
  return chunks.join('');
}
