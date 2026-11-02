/**
 * `toKotlin(resolved, { packageName, name })`: the tokens as Jetpack
 * Compose constants.
 *
 * ```kotlin
 * package com.example.tokens
 *
 * import androidx.compose.ui.graphics.Color
 * import androidx.compose.ui.unit.dp
 *
 * object Tokens {
 *     val ColorPrimary = Color(0xFF6750A4)
 *     val SpaceMedium = 16.dp
 *     const val MotionDurationShortMs = 150
 * }
 * ```
 *
 * colour -> `Color(0xAARRGGBB)`, dimension -> `Dp` (1rem = 16.dp),
 * duration -> `const val ...Ms` milliseconds, number -> `const val` Float,
 * fontFamily -> `List<String>`, fontWeight -> `FontWeight(n)`,
 * cubicBezier -> `CubicBezierEasing`, shadow -> `Shadow` or
 * `List<Shadow>`, typography -> `Typography` (both data classes are
 * generated when used). An alias is its target's constant; a mode is a
 * nested object (`Tokens.Dark`) with the constants the mode changes.
 */

import { values as coreValues } from '@link-foundation/ui-core';
import { upperCamel } from '../names.js';
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

const { toHex } = coreValues;

/** @typedef {import('../types.js').ResolvedTokens} ResolvedTokens */

const constant = (token) =>
  `${upperCamel(token.path)}${token.type === 'duration' ? 'Ms' : ''}`;

const float = (x) => `${num(x)}f`;
const dp = (d) => `${num(points(d))}.dp`;

/** `Color(0xAARRGGBB)`. */
function color(c) {
  const hex = toHex({ type: 'color', space: 'srgb', ...rgba(c) });
  const alpha = hex.length === 9 ? hex.slice(7) : 'FF';
  return `Color(0x${alpha}${hex.slice(1, 7)})`;
}

const fontFamily = (f) =>
  `listOf(${[f.value]
    .flat()
    .map((s) => JSON.stringify(s))
    .join(', ')})`;

const shadowLayer = (l) =>
  `Shadow(${color(l.color)}, ${dp(l.offsetX)}, ${dp(l.offsetY)}, ${dp(l.blur)}, ${dp(l.spread)}, ${l.inset === true})`;

/** `[const, expression]` of a resolved value. */
function kotlinValue(value) {
  switch (value.type) {
    case 'color':
      return [false, color(value)];
    case 'dimension':
      return [false, dp(value)];
    case 'duration':
      return [true, num(millis(value))];
    case 'number':
      return [true, float(value.value)];
    case 'fontFamily':
      return [false, fontFamily(value)];
    case 'fontWeight':
      return [false, `FontWeight(${weight(value)})`];
    case 'cubicBezier':
      return [false, `CubicBezierEasing(${value.value.map(float).join(', ')})`];
    case 'shadow': {
      const all = layers(value).map(shadowLayer);
      return [
        false,
        Array.isArray(value.value) ? `listOf(${all.join(', ')})` : all[0],
      ];
    }
    default: {
      const t = value.value;
      return [
        false,
        `Typography(${fontFamily(t.fontFamily)}, ${num(points(t.fontSize))}.sp, FontWeight(${weight(t.fontWeight)}), ${num(points(t.letterSpacing))}.sp, ${float(t.lineHeight.value)})`,
      ];
    }
  }
}

/** A KDoc comment: one line when the text is one line. */
function kdoc(text, pad) {
  const body = descriptionLines(text.replaceAll('*/', '* /'));
  return body.length === 1
    ? [`${pad}/** ${body[0]} */`]
    : [`${pad}/**`, ...body.map((l) => `${pad} * ${l}`), `${pad} */`];
}

/** The imports the used types need, sorted. */
function imports(types) {
  const out = new Set();
  const need = {
    color: ['androidx.compose.ui.graphics.Color'],
    dimension: ['androidx.compose.ui.unit.dp'],
    shadow: ['androidx.compose.ui.unit.Dp'],
    fontWeight: ['androidx.compose.ui.text.font.FontWeight'],
    cubicBezier: ['androidx.compose.animation.core.CubicBezierEasing'],
    typography: [
      'androidx.compose.ui.unit.TextUnit',
      'androidx.compose.ui.unit.sp',
    ],
  };
  for (const type of types) {
    for (const name of need[type] ?? []) {
      out.add(name);
    }
  }
  return [...out].sort().map((name) => `import ${name}`);
}

const DATA_CLASSES = {
  shadow: [
    '    data class Shadow(',
    '        val color: Color,',
    '        val offsetX: Dp,',
    '        val offsetY: Dp,',
    '        val blur: Dp,',
    '        val spread: Dp,',
    '        val inset: Boolean = false,',
    '    )',
  ],
  typography: [
    '    data class Typography(',
    '        val fontFamily: List<String>,',
    '        val fontSize: TextUnit,',
    '        val fontWeight: FontWeight,',
    '        val letterSpacing: TextUnit,',
    '        val lineHeight: Float,',
    '    )',
  ],
};

/**
 * The tokens as a Kotlin source file.
 * @param {ResolvedTokens} resolved
 * @param {{ packageName?: string, name?: string }} [options]  the package
 *   (none when omitted) and the object name (default `Tokens`)
 * @returns {string}
 */
export function toKotlin(resolved, { packageName, name = 'Tokens' } = {}) {
  const all = sections(resolved, name);
  checkNames(all, constant);
  const types = usedTypes(all);
  const lines = [];
  if (packageName !== undefined) {
    lines.push(`package ${packageName}`, '');
  }
  const head = imports(types);
  if (head.length > 0) {
    lines.push(...head, '');
  }
  lines.push(`object ${name} {`);
  for (const kind of ['shadow', 'typography']) {
    if (types.has(kind)) {
      lines.push(...DATA_CLASSES[kind], '');
    }
  }
  for (const section of all) {
    const pad = section.mode === null ? '    ' : '        ';
    if (section.mode !== null) {
      lines.push(
        '',
        `    /** The tokens the mode "${section.mode}" changes. */`
      );
      lines.push(`    object ${section.scope[1]} {`);
    }
    for (const token of section.tokens.values()) {
      if (token.description !== undefined) {
        lines.push(...kdoc(token.description, pad));
      }
      const [isConst, expression] = kotlinValue(token.value);
      const value =
        token.alias === undefined
          ? expression
          : aliasReference(token, section, constant, resolved);
      lines.push(
        `${pad}${isConst ? 'const ' : ''}val ${constant(token)} = ${value}`
      );
    }
    if (section.mode !== null) {
      lines.push('    }');
    }
  }
  lines.push('}');
  return `${lines.join('\n')}\n`;
}
