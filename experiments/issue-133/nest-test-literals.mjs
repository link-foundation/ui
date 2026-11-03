// Rewrites whole-document LiNo string literals in test files from the
// parenthesized multiline form to the nested form (#133).
// Usage: node nest-test-literals.mjs file.test.js...
// Only literals that start with "(", end with ")\n" and are exactly the
// multiline form of their document are touched, and only when the nested
// text reads back as the same document.
import { readFileSync, writeFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import * as acorn from 'acorn';
import { format, parse } from '@link-foundation/ui-core';

const nested = (text) => {
  if (!text.startsWith('(') || !text.endsWith(')\n')) {
    return undefined;
  }
  try {
    // Read like ui-core `parse` (it folds the multiline form back), and only
    // touch text that is exactly the multiline form of its document.
    const doc = parse(text, { checks: false });
    if (format(doc, { style: 'multiline' }) !== text) {
      return undefined;
    }
    const out = format(doc);
    const again = parse(out, { checks: false });
    return isDeepStrictEqual(again.roots, doc.roots) &&
      isDeepStrictEqual(again.unknown, doc.unknown)
      ? out
      : undefined;
  } catch {
    return undefined;
  }
};

const literal = (text) => {
  const single = `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
  return text.includes("'") && !text.includes('"')
    ? JSON.stringify(text)
    : single;
};

for (const file of process.argv.slice(2)) {
  const source = readFileSync(file, 'utf8');
  const ast = acorn.parse(source, {
    ecmaVersion: 'latest',
    sourceType: 'module',
  });
  const edits = [];
  const visit = (node) => {
    if (!node || typeof node.type !== 'string') {
      return;
    }
    let out;
    if (node.type === 'Literal' && typeof node.value === 'string') {
      out = nested(node.value);
    } else if (
      node.type === 'TemplateLiteral' &&
      node.expressions.length === 0
    ) {
      out = nested(node.quasis[0].value.cooked);
    }
    if (out) {
      edits.push([node.start, node.end, literal(out)]);
      return;
    }
    for (const value of Object.values(node)) {
      for (const child of Array.isArray(value) ? value : [value]) {
        if (child && typeof child === 'object') {
          visit(child);
        }
      }
    }
  };
  visit(ast);
  let text = source;
  for (const [start, end, value] of edits.sort((a, b) => b[0] - a[0])) {
    text = text.slice(0, start) + value + text.slice(end);
  }
  if (edits.length > 0) {
    writeFileSync(file, text);
  }
  console.log(file, edits.length);
}
