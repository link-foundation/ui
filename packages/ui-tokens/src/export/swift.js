/**
 * `toSwift(resolved, { name })`: the tokens as SwiftUI constants.
 *
 * ```swift
 * import SwiftUI
 *
 * public enum Tokens {
 *   public static let colorPrimary = Color(red: 0.404, green: 0.314, blue: 0.643, opacity: 1)
 *   public static let spaceMedium: CGFloat = 16
 *   public static let motionDurationShort: TimeInterval = 0.15
 * }
 * ```
 *
 * colour -> `Color` (sRGB, 3 decimals), dimension -> `CGFloat` points
 * (1rem = 16), duration -> `TimeInterval` seconds, number -> `Double`,
 * fontFamily -> `[String]`, fontWeight -> `Font.Weight` (nearest),
 * cubicBezier -> a labelled tuple of `Double`, shadow -> `Shadow` or
 * `[Shadow]`, typography -> `Typography` (both structs are generated when
 * used). An alias is its target's constant; a mode is a nested enum
 * (`Tokens.Dark`) with the constants the mode changes.
 */

import { lowerCamel } from '../names.js';
import { COMPOSITE_FIELDS } from '../values.js';
import {
  aliasReference,
  checkNames,
  descriptionLines,
  layers,
  millis,
  num,
  points,
  rgba,
  sections,
  usedTypes,
  weight,
} from './native.js';

/** @typedef {import('../types.js').ResolvedTokens} ResolvedTokens */

/** Swift keywords that are names of their own and need backticks. */
const KEYWORDS = new Set(
  'associatedtype class deinit enum extension fileprivate func import init inout internal let open operator private protocol public rethrows static struct subscript typealias var break case continue default defer do else fallthrough for guard if in repeat return switch where while as Any catch false is nil super self Self throw throws true try'.split(
    ' '
  )
);

const constant = (token) => {
  const name = lowerCamel(token.path);
  return KEYWORDS.has(name) ? `\`${name}\`` : name;
};

/** `Font.Weight` by the nearest hundred. */
const FONT_WEIGHT_NAMES = [
  'ultraLight',
  'thin',
  'light',
  'regular',
  'medium',
  'semibold',
  'bold',
  'heavy',
  'black',
];

const fontWeight = (w) => {
  const i = Math.min(8, Math.max(0, Math.round(weight(w) / 100) - 1));
  return `.${FONT_WEIGHT_NAMES[i]}`;
};

const swiftString = (s) => JSON.stringify(s);

const color = (c) => {
  const { r, g, b, a } = rgba(c);
  const d = (x) => num(Math.round(x * 1000) / 1000);
  return `Color(red: ${d(r)}, green: ${d(g)}, blue: ${d(b)}, opacity: ${d(a)})`;
};

const shadowLayer = (l) =>
  `Shadow(color: ${color(l.color)}, offsetX: ${num(points(l.offsetX))}, offsetY: ${num(points(l.offsetY))}, blur: ${num(points(l.blur))}, spread: ${num(points(l.spread))}, inset: ${l.inset === true})`;

const fontFamily = (f) => `[${[f.value].flat().map(swiftString).join(', ')}]`;

/** `[Swift type, expression]` of a resolved value. */
function swiftValue(value) {
  switch (value.type) {
    case 'color':
      return ['Color', color(value)];
    case 'dimension':
      return ['CGFloat', num(points(value))];
    case 'duration':
      return ['TimeInterval', num(millis(value) / 1000)];
    case 'number':
      return ['Double', num(value.value)];
    case 'fontFamily':
      return ['[String]', fontFamily(value)];
    case 'fontWeight':
      return ['Font.Weight', fontWeight(value)];
    case 'cubicBezier':
      return [
        '(x1: Double, y1: Double, x2: Double, y2: Double)',
        `(${value.value.map(num).join(', ')})`,
      ];
    case 'shadow': {
      const all = layers(value).map(shadowLayer);
      return Array.isArray(value.value)
        ? ['[Shadow]', `[${all.join(', ')}]`]
        : ['Shadow', all[0]];
    }
    default: {
      const t = value.value;
      return [
        'Typography',
        `Typography(fontFamily: ${fontFamily(t.fontFamily)}, fontSize: ${num(points(t.fontSize))}, fontWeight: ${fontWeight(t.fontWeight)}, letterSpacing: ${num(points(t.letterSpacing))}, lineHeight: ${num(t.lineHeight.value)})`,
      ];
    }
  }
}

const SWIFT_FIELD_TYPES = {
  color: 'Color',
  dimension: 'CGFloat',
  fontFamily: '[String]',
  fontWeight: 'Font.Weight',
  number: 'Double',
};

function struct(name, kind, pad, extra = []) {
  return [
    `${pad}public struct ${name} {`,
    ...COMPOSITE_FIELDS[kind].map(
      ([, key, type]) => `${pad}  public let ${key}: ${SWIFT_FIELD_TYPES[type]}`
    ),
    ...extra.map((line) => `${pad}  ${line}`),
    `${pad}}`,
  ];
}

/**
 * The tokens as a Swift source file.
 * @param {ResolvedTokens} resolved
 * @param {{ name?: string }} [options]  the enum name (default `Tokens`)
 * @returns {string}
 */
export function toSwift(resolved, { name = 'Tokens' } = {}) {
  const all = sections(resolved, name);
  checkNames(all, constant);
  const types = usedTypes(all);
  const lines = ['import SwiftUI', '', `public enum ${name} {`];
  if (types.has('shadow')) {
    lines.push(
      ...struct('Shadow', 'shadow', '  ', ['public let inset: Bool']),
      ''
    );
  }
  if (types.has('typography')) {
    lines.push(...struct('Typography', 'typography', '  '), '');
  }
  for (const section of all) {
    const pad = section.mode === null ? '  ' : '    ';
    if (section.mode !== null) {
      lines.push('', `  /// The tokens the mode "${section.mode}" changes.`);
      lines.push(`  public enum ${section.scope[1]} {`);
    }
    for (const token of section.tokens.values()) {
      if (token.description !== undefined) {
        lines.push(
          ...descriptionLines(token.description).map((l) => `${pad}/// ${l}`)
        );
      }
      const [type, expression] = swiftValue(token.value);
      const value =
        token.alias === undefined
          ? expression
          : aliasReference(token, section, constant, resolved);
      const annotation = token.type === 'color' ? '' : `: ${type}`;
      lines.push(
        `${pad}public static let ${constant(token)}${annotation} = ${value}`
      );
    }
    if (section.mode !== null) {
      lines.push('  }');
    }
  }
  lines.push('}');
  return `${lines.join('\n')}\n`;
}
