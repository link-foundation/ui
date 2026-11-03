#!/usr/bin/env node
/**
 * List the string and template literals of JavaScript sources that hold
 * Links Notation in the parenthesized form, that is literals that
 * `nestLino` of scripts/lino-nest.mjs would change (#133).
 *
 *   node experiments/issue-133/find-paren-literals.mjs file.js...
 *
 * A literal is reported when it starts with `(`, reads as Links Notation
 * and is not already in the nested form. Template literals with `${` are
 * read with the substitutions replaced by a placeholder word.
 */

import { readFileSync } from 'node:fs';
import * as acorn from 'acorn';
import { nestLino } from '../../scripts/lino-nest.mjs';

const textOf = (node) => {
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return node.value;
  }
  if (node.type === 'TemplateLiteral') {
    return node.quasis.map((q) => q.value.cooked).join('X');
  }
  return undefined;
};

for (const file of process.argv.slice(2)) {
  let ast;
  try {
    ast = acorn.parse(readFileSync(file, 'utf8'), {
      ecmaVersion: 'latest',
      sourceType: 'module',
      locations: true,
      allowHashBang: true,
    });
  } catch (error) {
    console.error(`${file}: not parsed (${error.message})`);
    continue;
  }
  const visit = (node) => {
    const text = textOf(node);
    if (text === undefined || !text.trimStart().startsWith('(')) {
      return;
    }
    let nested;
    try {
      nested = nestLino(text);
    } catch {
      return;
    }
    if (nested.trim() !== text.trim()) {
      const lines = text.split('\n').length;
      console.log(
        `${file}:${node.loc.start.line}: ${lines} line(s): ${text.split('\n')[0].slice(0, 70)}`
      );
    }
  };
  const walk = (node) => {
    if (node === null || typeof node !== 'object') {
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node.type === 'string') {
      visit(node);
    }
    for (const [key, value] of Object.entries(node)) {
      if (key !== 'loc') {
        walk(value);
      }
    }
  };
  walk(ast);
}
