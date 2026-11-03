// Minimal reproductions for links-notation formatter round-trip problems
// (reported upstream, see docs/case-studies/issue-133/README.md).
import { Link, Parser, FormatOptions, formatLinks } from 'links-notation';

const parser = new Parser();
const check = (label, links, text) => {
  let back;
  try {
    back = parser.parse(text);
  } catch (error) {
    back = error.message;
  }
  const same =
    Array.isArray(back) &&
    back.length === links.length &&
    back.every((link, i) => link.equals(links[i]));
  console.log(`${label}\n  input : ${links.map((l) => l.format()).join(' | ')}\n  text  : ${JSON.stringify(text)}\n  reads : ${Array.isArray(back) ? back.map((l) => l.format()).join(' | ') : back}\n  round-trips: ${same}`);
};

// 1. lessParentheses drops the parentheses that make ((b c)) a nested link.
const nested = [parser.parse('((b c))')[0]];
check('format(true) of ((b c))', nested, nested[0].format(true));

// 2. Indented output (preferInline: false) does not read back as the input.
const named = parser.parse('x: a b');
check(
  'FormatOptions({ maxInlineRefs: 1, preferInline: false }) of (x: a b)',
  named,
  formatLinks(named, new FormatOptions({ lessParentheses: true, maxInlineRefs: 1, preferInline: false }))
);
const anonymous = parser.parse('a b c');
check(
  'FormatOptions({ maxInlineRefs: 1, preferInline: false }) of (a b c)',
  anonymous,
  formatLinks(anonymous, new FormatOptions({ lessParentheses: true, maxInlineRefs: 1, preferInline: false }))
);
