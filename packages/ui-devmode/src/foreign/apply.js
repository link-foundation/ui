import { DevModeError } from '../model.js';

const refuse = (message) => {
  throw new DevModeError('bad-value', message);
};
const scriptUrl = (value) =>
  /(?:javascript|vbscript):/i.test(
    [...value].filter((c) => c.charCodeAt(0) > 32).join('')
  );

/** Validate a foreign edit before writing anything to the page. */
export function checkProperty(node, name, value) {
  if (typeof value !== 'string') {
    refuse('Foreign properties need text values');
  }
  if (!node || ![1, 3].includes(node.nodeType)) {
    refuse('Unknown DOM node');
  }
  if (name === 'text') {
    if (
      node.nodeType === 1 &&
      (node.children.length || ['script', 'style'].includes(node.localName))
    ) {
      refuse('Only leaf element text is editable');
    }
    return;
  }
  if (node.nodeType !== 1) {
    refuse('Only elements have attributes and styles');
  }
  const [kind, key, ...extra] = name.split(' ');
  if (!key || extra.length || !['attr', 'style'].includes(kind)) {
    refuse('Expected text, attr <name> or style <property>');
  }
  if (scriptUrl(value)) {
    refuse('Script URLs are not editable');
  }
  checkDeclaration(kind, key, value);
}

/** Text, a single attribute, or a single inline CSS declaration. */
export function applyProperty(node, name, value) {
  checkProperty(node, name, value);
  if (name === 'text') {
    node.textContent = value;
  } else if (name.startsWith('attr ')) {
    node.setAttribute(name.slice(5), value);
  } else {
    node.style.setProperty(name.slice(6), value);
  }
}

export function readProperty(node, name) {
  if (name === 'text') {
    return node.textContent;
  }
  if (name.startsWith('attr ')) {
    return node.getAttribute(name.slice(5));
  }
  return node.style.getPropertyValue(name.slice(6));
}

/** Restore absence as well as values when discarding or resetting edits. */
export function restoreProperty(node, name, value, priority = '') {
  if (name.startsWith('attr ') && value === null) {
    node.removeAttribute(name.slice(5));
  } else if (name.startsWith('style ')) {
    if (value) {
      node.style.setProperty(name.slice(6), value, priority);
    } else {
      node.style.removeProperty(name.slice(6));
    }
  } else {
    applyProperty(node, name, value ?? '');
  }
}

function checkDeclaration(kind, key, value) {
  if (kind === 'attr') {
    if (/^on/i.test(key) || ['srcdoc', 'style'].includes(key.toLowerCase())) {
      refuse('Executable attributes are not editable');
    }
  } else if (
    !/^(?:--[\w-]+|[a-z][a-z-]*)$/.test(key) ||
    /expression\s*\(|-moz-binding/i.test(value)
  ) {
    refuse('Unsafe style declaration');
  }
}
