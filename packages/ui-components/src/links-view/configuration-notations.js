import { CstKind, Parser } from 'links-notation';
import {
  parseNested,
  formatLinks as writeLinks,
} from '@link-foundation/ui-core';
import {
  checked,
  invalid,
  fromDigits,
  decode,
  linksAt,
  indexOf,
} from './configuration-model.js';

export const configurationMessages = Object.freeze({
  en: Object.freeze({
    'configurations.reference':
      'A reference must be between 0 and the number of links.',
    'configurations.base': 'The base must equal the number of links plus one.',
    'configurations.digits': 'Supply exactly two digits per link.',
    'configurations.index': 'The decimal index is outside the network range.',
    'configurations.name':
      'Name every link 1 through n exactly once, or leave all unnamed.',
    'configurations.syntax': 'Invalid network notation.',
  }),
  ru: Object.freeze({
    'configurations.reference': 'Ссылка должна быть от 0 до числа связей.',
    'configurations.base':
      'Основание должно быть на единицу больше числа связей.',
    'configurations.digits': 'Укажите ровно две цифры для каждой связи.',
    'configurations.index': 'Десятичный индекс вне диапазона сети.',
    'configurations.name':
      'Назовите все связи от 1 до n ровно один раз или оставьте все без имён.',
    'configurations.syntax': 'Неверная запись сети.',
  }),
});

function result(read) {
  try {
    return { links: read() };
  } catch (error) {
    return {
      error: Object.hasOwn(configurationMessages.en, error.message)
        ? error.message
        : 'configurations.syntax',
      ...(error.params && { params: error.params }),
    };
  }
}
const subs = '₀₁₂₃₄₅₆₇₈₉';
const subscript = (value) =>
  [...String(value)].map((d) => subs[Number(d)]).join('');

function based(text) {
  const source = text.trim();
  const match = /(?:_(\d+)|([₀-₉]+))$/u.exec(source);
  if (!match) {
    return { text: source, base: null };
  }
  const base = match[1] ?? [...match[2]].map((d) => subs.indexOf(d)).join('');
  return { text: source.slice(0, match.index).trim(), base: Number(base) };
}
function checkBase(linkCount, actualBase) {
  const expectedBase = linkCount + 1;
  if (actualBase !== null && actualBase !== expectedBase) {
    invalid('base', { actualBase, expectedBase, linkCount });
  }
}

export const parseCode = (text) => result(() => decode(text));
export const parseDecimal = (text, n, options) =>
  result(() => linksAt(n, text, options));
export const formatDecimal = (links, options) =>
  indexOf(links, options).toString();

export function formatNumber(links) {
  checked(links);
  const digits = links.flat();
  return (
    (links.length <= 9 ? digits.join('') : `[${digits.join(' ')}]`) +
    subscript(links.length + 1)
  );
}
export function parseNumber(source) {
  return result(() => {
    const { text, base } = based(source);
    let digits;
    if (/^\[\s*\d+(?:(?:\s*,\s*|\s+)\d+)*\s*\]$/u.test(text)) {
      digits = text.match(/\d+/gu).map(Number);
    } else if (/^\d+(?:[\s.-]+\d+)*$/u.test(text)) {
      digits = [...text.replace(/[\s.-]/gu, '')].map(Number);
    } else {
      invalid('syntax');
    }
    if (digits.length % 2) {
      invalid('digits', { digitCount: digits.length });
    }
    checkBase(digits.length / 2, base);
    return fromDigits(digits);
  });
}
export function formatPairs(links) {
  checked(links);
  return links
    .map(
      (pair) =>
        (links.length <= 9 ? pair.join('') : `(${pair.join(',')})`) +
        subscript(links.length + 1)
    )
    .join(' ');
}
function readPairs(source, inferBase = false) {
  const parts = source.match(
    /\(\s*\d+\s*,\s*\d+\s*\)(?:[₀-₉]+|_\d+)|\d{2}(?:[₀-₉]+|_\d+|(?=\s|$))/gu
  );
  if (
    !parts ||
    parts.join('').replace(/\s/gu, '') !== source.replace(/\s/gu, '')
  ) {
    invalid('syntax');
  }
  const links = parts.map((part) => {
    const { text, base } = based(part);
    if (base === null && !inferBase) {
      invalid('syntax');
    }
    checkBase(parts.length, base);
    return text.startsWith('(')
      ? text.slice(1, -1).split(',').map(Number)
      : [...text].map(Number);
  });
  return checked(links);
}

export const parsePairs = (source) => result(() => readPairs(source));

function named(pairs, names) {
  if (names.every((name) => name === null)) {
    return checked(pairs);
  }
  if (
    names.some(
      (name) => !Number.isSafeInteger(name) || name < 1 || name > pairs.length
    ) ||
    new Set(names).size !== pairs.length
  ) {
    invalid('name', { linkCount: pairs.length });
  }
  const ordered = Array(pairs.length);
  pairs.forEach((pair, i) => {
    ordered[names[i] - 1] = pair;
  });
  return checked(ordered);
}
export function formatTheory(links, { set = 'λ' } = {}) {
  checked(links);
  if (!['λ', 'N²', 'L', 'R'].includes(set)) {
    invalid('syntax');
  }
  return `${set} = {${links.map((pair, i) => `${i + 1} ↦ (${pair.join(', ')})`).join(', ')}}`;
}
export function parseTheory(source) {
  return result(() => {
    const text = source
      .trim()
      .replace(/^(?:N²\s*=\s*(?:[λLR]\s*=\s*)?|[λLR]\s*=\s*)/u, '');
    const body =
      text.startsWith('{') && text.endsWith('}')
        ? text.slice(1, -1).trim()
        : text;
    if (!body.includes('(') || /[₀-₉_]/u.test(body)) {
      return readPairs(body, true);
    }

    const entries = body.matchAll(
      /(?:(\d+)\s*(?:↦|->|→|=>|:)\s*)?\(\s*(\d+)(?:\s*,\s*|\s+)(\d+)\s*\)/gu
    );
    const names = [],
      pairs = [];
    let end = 0;
    for (const entry of entries) {
      const separator = body.slice(end, entry.index).trim();
      if (separator !== '' && !(pairs.length && separator === ',')) {
        invalid('syntax');
      }
      const [match, name, source, target] = entry;
      names.push(name === undefined ? null : Number(name));
      pairs.push([Number(source), Number(target)]);
      end = entry.index + match.length;
    }
    if (!pairs.length || body.slice(end).trim()) {
      invalid('syntax');
    }
    return named(pairs, names);
  });
}

const linksLimits = Object.freeze({ maxInputSize: 100000, maxDepth: 32 });

function linkText(node, inRecord = false) {
  if (inRecord && node.kind === CstKind.GROUP) {
    invalid('syntax');
  }
  if (!node.isToken) {
    return node.children
      .map((child) => linkText(child, inRecord || node.kind === CstKind.GROUP))
      .join('');
  }
  // Bare commas were separators in the legacy editor. Leave quoted references,
  // literals and comments intact so the official parser still interprets them.
  return node.kind === CstKind.REFERENCE && node.text === node.value
    ? node.text.replaceAll(',', ' ')
    : node.text;
}

function flatLinkSource(source) {
  const document = new Parser(linksLimits).parseCst(source);
  return document.children
    .map(({ children }) => {
      const records = children.filter((node) => node.kind === CstKind.GROUP);
      if (!records.length) {
        return children.map((node) => linkText(node)).join('');
      }
      if (
        children.some(
          (node) =>
            node.kind !== CstKind.GROUP &&
            node.kind !== CstKind.COMMENT &&
            linkText(node).trim()
        )
      ) {
        invalid('syntax');
      }
      const first = children[0];
      const indent = first.kind === CstKind.WHITESPACE ? first.text : '';
      // Adjacent parenthesized records are one anonymous value in LiNo.
      // Give each record its own line without unwrapping a nested group.
      const separator = `\n${indent}`;
      return `${indent}${records.map((record) => linkText(record)).join(separator)}\n`;
    })
    .join('');
}

/** Only the official LiNo parser reads Links notation, including indented groups. */
export function parseLinks(source) {
  return result(() => {
    const compatible =
      source.includes(',') || source.includes('(')
        ? flatLinkSource(source)
        : source;
    const roots = parseNested(compatible, linksLimits);
    const names = [],
      pairs = [];
    for (const link of roots) {
      if (link.values.length !== 2) {
        invalid('digits');
      }
      names.push(
        link.id === null ? null : /^\d+$/u.test(link.id) ? Number(link.id) : NaN
      );
      pairs.push(
        link.values.map((value) => {
          if (value.values.length || !/^\d+$/u.test(value.id ?? '')) {
            invalid('reference');
          }
          return Number(value.id);
        })
      );
    }
    return named(pairs, names);
  });
}
export function formatLinks(links, { style = 'indented' } = {}) {
  checked(links);
  const text = writeLinks(
    links.map((pair, i) => ({ id: String(i + 1), values: pair.map(String) })),
    { style }
  );
  return style === 'inline' ? text.trimEnd().replaceAll('\n', ' ') : text;
}
