import { parse, values } from '@link-foundation/ui-core';

const PROPERTIES = {
  'font-size': 'fontSize',
  'font-weight': 'fontWeight',
  'border-width': 'borderWidth',
  'border-color': 'borderColor',
  direction: 'flexDirection',
  elevation: 'elevation',
  radius: 'borderRadius',
  background: 'backgroundColor',
  scale: 'scale',
  padding: 'padding',
  gap: 'gap',
  color: 'color',
  opacity: 'opacity',
  width: 'width',
  height: 'height',
  margin: 'margin',
  fontSize: 'fontSize',
  fontWeight: 'fontWeight',
  lineHeight: 'lineHeight',
  flex: 'flex',
  flexDirection: 'flexDirection',
  alignItems: 'alignItems',
  justifyContent: 'justifyContent',
  borderWidth: 'borderWidth',
  borderColor: 'borderColor',
};

function typedValue(value, tokens, seen) {
  if ('path' in value && 'value' in value) {
    return nativeValue(value.value, tokens, seen);
  }
  if (value.type === 'list') {
    return value.items.map((item) => nativeValue(item, tokens, new Set(seen)));
  }
  if (value.type === 'color') {
    return values.toHex(value);
  }
  if (value.type === 'dimension') {
    return value.unit === 'px' ? value.value : undefined;
  }
  if (['number', 'enum', 'string', 'fontWeight'].includes(value.type)) {
    return value.value;
  }
  return undefined;
}

function tokenPath(value) {
  if (Array.isArray(value) && value[0] === 'token') {
    return value[1];
  }
  return value?.type === 'token-ref' ? value.path : null;
}

function atomValue(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value !== 'string') {
    return undefined;
  }
  if (value.endsWith('px')) {
    const number = Number(value.slice(0, -2));
    return Number.isFinite(number) ? number : undefined;
  }
  return value;
}

/** Convert raw or ui-style/ui-tokens typed values without interpreting code. */
function nativeValue(raw, tokens, seen = new Set()) {
  let value = raw;
  if (typeof value === 'string' && value.trim().startsWith('(')) {
    const doc = parse(`value: text (value ${value})`);
    value = doc.roots[0]?.properties.find((p) => p.name === 'value')?.values[0];
  }
  const path = tokenPath(value);
  if (path !== null) {
    if (seen.has(path)) {
      return undefined;
    }
    seen.add(path);
    return nativeValue(
      tokens instanceof Map ? tokens.get(path) : tokens?.[path],
      tokens,
      seen
    );
  }
  if (value && typeof value === 'object') {
    return typedValue(value, tokens, seen);
  }
  return atomValue(value);
}

const LIST_PROPERTIES = {
  padding: ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'],
  borderRadius: [
    'borderTopLeftRadius',
    'borderTopRightRadius',
    'borderBottomRightRadius',
    'borderBottomLeftRadius',
  ],
  gap: ['rowGap', 'columnGap'],
};

function applyList(style, name, items) {
  const keys = LIST_PROPERTIES[name];
  if (
    !keys ||
    items.length < 1 ||
    items.length > keys.length ||
    items.some((item) => typeof item !== 'number' || !Number.isFinite(item))
  ) {
    return false;
  }
  const [top, right = top, bottom = top, left = right] = items;
  const expanded = [top, right, bottom, left];
  keys.forEach((key, index) => {
    style[key] = expanded[index];
  });
  return true;
}

/** Resolved declarations from ui-style, or a plain property/value object.
 * Unsupported properties/values are dropped and reported, never silently applied.
 */
export function toNativeStyle(declarations = {}, tokens = {}) {
  const style = {};
  const warnings = [];
  for (const [property, raw] of Object.entries(declarations)) {
    const name = Object.hasOwn(PROPERTIES, property)
      ? PROPERTIES[property]
      : undefined;
    const value = nativeValue(raw, tokens);
    if (name === undefined || value === undefined) {
      warnings.push(`unsupported native style ${property}`);
    } else if (Array.isArray(value)) {
      if (!applyList(style, name, value)) {
        warnings.push(`unsupported native style ${property}`);
      }
    } else if (name === 'scale') {
      style.transform = [{ scale: value }];
    } else {
      style[name] =
        property === 'direction'
          ? value === 'horizontal'
            ? 'row'
            : 'column'
          : name === 'fontWeight'
            ? String(value)
            : value;
    }
  }
  return { style, warnings };
}
