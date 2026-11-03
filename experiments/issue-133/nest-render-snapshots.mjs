/**
 * Rewrite the render-tree snapshots of ui-swift and ui-kotlin (#133) the way
 * the nested `dumpLino` writes them: a line is `indent (head)` followed by
 * the `)` that close its parents, or `indent (head` when the node has
 * children; it becomes `indent head`. The head is
 * found with a quote-aware scan, and every result is checked with the
 * official parser: the nested text must read as the same links as the
 * original one with the original's path links folded.
 *   node experiments/issue-133/nest-render-snapshots.mjs <file>...
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { parseLinks } from '../../packages/ui-core/src/index.js';
import { fold } from '../../scripts/lino-nest.mjs';

/**
 * The end (exclusive) of the link that starts at `start`, or `null` when it
 * is still open at the end of the line (a node with children).
 */
function linkEnd(line, start) {
  let depth = 0;
  for (let i = start; i < line.length; i++) {
    const c = line[i];
    if ((c === "'" || c === '"' || c === '`') && /[\s(]/u.test(line[i - 1])) {
      i++;
      while (i < line.length) {
        if (line[i] === c && line[i + 1] === c) {
          i += 2;
        } else if (line[i] === c) {
          break;
        } else {
          i++;
        }
      }
    } else if (c === '(') {
      depth++;
    } else if (c === ')' && --depth === 0) {
      return i + 1;
    }
  }
  if (depth === 1) {
    return null;
  }
  throw new Error(`unbalanced line: ${line}`);
}

function nestLine(line) {
  const indent = line.match(/^ */u)[0];
  const end = linkEnd(line, indent.length);
  if (end === null) {
    return indent + line.slice(indent.length + 1);
  }
  if (!/^\)*$/u.test(line.slice(end))) {
    throw new Error(`unexpected text after the head: ${line}`);
  }
  return indent + line.slice(indent.length + 1, end - 1);
}

for (const file of process.argv.slice(2)) {
  const text = readFileSync(file, 'utf8');
  const lines = text.replace(/\n$/u, '').split('\n');
  const nested = `${lines.map(nestLine).join('\n')}\n`;
  const same =
    JSON.stringify(parseLinks(nested)) ===
    JSON.stringify(parseLinks(text).map(fold));
  if (!same) {
    throw new Error(`${file} would read differently`);
  }
  writeFileSync(file, nested);
}
