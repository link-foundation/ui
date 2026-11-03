import { propsOf } from '@link-foundation/ui-react/hooks';
import { toNativeStyle } from './style.js';

export function developmentWarn(message) {
  if (globalThis.process?.env?.NODE_ENV !== 'production') {
    console.warn(`[ui-react-native] ${message}`);
  }
}

/** Pure mapping of a UiNode or store ElementView; never imports native modules.
 * @returns {{type: string, props: object, children: (object|string)[]}}
 */
function mapKind(node, first, p, props, children, { declarations, warn }) {
  let type;
  switch (node.kind) {
    case 'document':
      type = 'ScrollView';
      break;
    case 'stack':
      type = 'View';
      declarations.flexDirection ??=
        first('direction', 'vertical') === 'horizontal' ? 'row' : 'column';
      if (p.gap) {
        declarations.gap ??= p.gap[0];
      }
      break;
    case 'text':
      type = 'Text';
      children.unshift(String(first('value', '')));
      break;
    case 'button': {
      type = 'Pressable';
      const disabled =
        first('disabled', 'false') === 'true' || first('disabled') === true;
      Object.assign(props, {
        accessibilityRole: 'button',
        disabled,
        accessibilityState: { disabled },
      });
      children.unshift({
        type: 'Text',
        props: {},
        children: [String(first('label', ''))],
      });
      break;
    }
    case 'image':
      type = 'Image';
      props.source = { uri: first('source', '') };
      props.accessibilityLabel = String(first('alt', ''));
      props.accessibilityRole = 'image';
      break;
    default:
      type = 'View';
      warn(`unknown kind ${node.kind}`);
  }
  return type;
}

function buttonTextStyle(style, children) {
  const labelStyle = {};
  for (const key of ['color', 'fontSize', 'fontWeight', 'lineHeight']) {
    if (key in style) {
      labelStyle[key] = style[key];
      delete style[key];
    }
  }
  if (Object.keys(labelStyle).length) {
    children[0].props.style = labelStyle;
  }
}

export function mapElement(node, ctx = {}) {
  const warn = ctx.warn ?? developmentWarn;
  const p = propsOf(node);
  const first = (name, fallback) => p[name]?.[0] ?? fallback;
  const props =
    node.id === null || node.id === undefined ? {} : { testID: node.id };
  const children = (node.children ?? []).map((child) => mapElement(child, ctx));
  const declarations = { ...(ctx.styles?.[node.id] ?? {}) };
  const type = mapKind(node, first, p, props, children, { declarations, warn });
  if (p['aria-label']) {
    props.accessibilityLabel = String(p['aria-label'][0]);
  }
  const { style, warnings } = toNativeStyle(declarations, ctx.tokens);
  warnings.forEach(warn);
  if (node.kind === 'button') {
    buttonTextStyle(style, children);
  }
  if (Object.keys(style).length) {
    props.style = style;
  }
  return { type, props, children };
}
