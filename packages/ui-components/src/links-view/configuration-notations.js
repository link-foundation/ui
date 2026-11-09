import { Link, Parser } from 'links-notation';
import { formatLinks as writeLinks } from '@link-foundation/ui-core';
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
    };
  }
}
const subs = '₀₁₂₃₄₅₆₇₈₉';
const subscript = (value) =>
  [...String(value)].map((d) => subs[Number(d)]).join('');

function based(text) {
  const match = /^(.*?)(?:_(\d+)|([₀-₉]+))$/u.exec(text.trim());
  if (!match) {
    invalid('base');
  }
  const base = match[2] ?? [...match[3]].map((d) => subs.indexOf(d)).join('');
  return { text: match[1].trim(), base: Number(base) };
}
function baseChecked(links, bases) {
  if (bases.some((base) => base !== links.length + 1)) {
    invalid('base');
  }
  return checked(links);
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
    if (/^\[\s*\d+(?:\s+\d+)*\s*\]$/u.test(text)) {
      digits = text.slice(1, -1).trim().split(/\s+/u).map(Number);
    } else if (/^\d+$/u.test(text)) {
      digits = [...text].map(Number);
    } else {
      invalid('syntax');
    }
    if (!digits.length || digits.length % 2) {
      invalid('digits');
    }
    if (base !== digits.length / 2 + 1) {
      invalid('base');
    }
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
export function parsePairs(source) {
  return result(() => {
    const parts = source
      .trim()
      .match(/\(\s*\d+\s*,\s*\d+\s*\)(?:[₀-₉]+|_\d+)|\d{2}(?:[₀-₉]+|_\d+)/gu);
    if (
      !parts ||
      parts.join('').replace(/\s/gu, '') !== source.replace(/\s/gu, '')
    ) {
      invalid('syntax');
    }
    const bases = [];
    const links = parts.map((part) => {
      const { text, base } = based(part);
      bases.push(base);
      return text.startsWith('(')
        ? text.slice(1, -1).split(',').map(Number)
        : [...text].map(Number);
    });
    return baseChecked(links, bases);
  });
}

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
    invalid('name');
  }
  const ordered = Array(pairs.length);
  pairs.forEach((pair, i) => {
    ordered[names[i] - 1] = pair;
  });
  return checked(ordered);
}
export function formatTheory(links, { set = 'λ' } = {}) {
  checked(links);
  if (!['λ', 'L', 'R'].includes(set)) {
    invalid('syntax');
  }
  return `${set} = {${links.map((pair, i) => `${i + 1} ↦ (${pair.join(', ')})`).join(', ')}}`;
}
export function parseTheory(source) {
  return result(() => {
    const outer = /^(?:N²\s*=\s*)?(?:λ|L|R)\s*=\s*\{(.*)\}$/u.exec(
      source.trim()
    );
    if (!outer) {
      invalid('syntax');
    }
    const entries = outer[1].match(
      /\d+\s*(?:↦|->|→|=>|:)\s*\(\s*\d+\s*,\s*\d+\s*\)/gu
    );
    if (
      !entries ||
      entries.join(',').replace(/\s/gu, '') !== outer[1].replace(/\s/gu, '')
    ) {
      invalid('syntax');
    }
    const names = [],
      pairs = [];
    for (const entry of entries) {
      const numbers = entry.match(/\d+/gu).map(Number);
      names.push(numbers[0]);
      pairs.push(numbers.slice(1));
    }
    return named(pairs, names);
  });
}

/** Only the official LiNo parser reads Links notation, including indented groups. */
export function parseLinks(source) {
  return result(() => {
    const unindent = ({ element, children }) =>
      new Link(element.id, [...element.values, ...children.map(unindent)]);
    const groups = new Parser({ maxInputSize: 100000, maxDepth: 32 })
      .parseGroups(source)
      .map(unindent);
    const roots = groups.flatMap((link) =>
      link.id === null && link.values.some((value) => value.values.length)
        ? link.values
        : [link]
    );
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
export function formatLinks(links) {
  checked(links);
  return writeLinks(
    links.map(
      (pair, i) =>
        new Link(
          String(i + 1),
          pair.map((value) => new Link(String(value), []))
        )
    )
  );
}
