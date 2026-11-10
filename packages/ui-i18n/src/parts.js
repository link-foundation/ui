/** Inline messages without HTML: render strings as text nodes and icons as labelled images. */

/** Describe an icon slot. Its label can be a localized message reference. */
export function iconPart(ref, label) {
  const colon = ref.indexOf(':');
  if (colon < 1 || colon === ref.length - 1 || !label) {
    throw new TypeError('iconPart requires SET:NAME and a label');
  }
  return {
    type: 'icon',
    set: ref.slice(0, colon),
    name: ref.slice(colon + 1),
    label,
  };
}

/**
 * Resolve a message then replace only known {token} slots with icon parts.
 * Unknown tokens stay literal; text is never parsed as HTML. Call again on
 * locale changes (localizer.subscribe). The helper has no DOM dependency.
 * @param {unknown} value
 * @param {{text(value: unknown, params?: object): string}} localizer
 * @param {Record<string, {type: 'icon', set: string, name: string, label: unknown}>} slots
 * @returns {(string | {type: 'icon', set: string, name: string, label: string, role: 'img'})[]}
 */
export function messageParts(value, localizer, slots = {}) {
  const text = localizer.text(value);
  const parts = [];
  let start = 0;
  for (const match of text.matchAll(/\{([^{}]+)\}/g)) {
    const key = match[1];
    if (!Object.hasOwn(slots, key)) {
      continue;
    }
    const slot = slots[key];
    if (slot?.type !== 'icon') {
      continue;
    }
    const label = localizer.text(slot.label).trim();
    if (!label) {
      throw new TypeError(`messageParts: icon ${key} needs a label`);
    }
    if (match.index > start) {
      parts.push(text.slice(start, match.index));
    }
    parts.push({ ...slot, label, role: 'img' });
    start = match.index + match[0].length;
  }
  if (start < text.length) {
    parts.push(text.slice(start));
  }
  return parts;
}
