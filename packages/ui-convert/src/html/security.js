/**
 * Security rules of the importer: scripts never reach the document.
 *
 * - `script`, `iframe`, `object` and `embed` elements are dropped with their
 *   content;
 * - every `on*` event handler attribute is dropped;
 * - every attribute whose value contains a `javascript:` (or `vbscript:`)
 *   URL is dropped (browsers ignore whitespace and case in the scheme, so
 *   the check does too).
 *
 * Each dropped item gives one `dropped-script` diagnostic.
 */

/** Elements dropped with their content. */
export const DROPPED_TAGS = ['script', 'iframe', 'object', 'embed'];

/** URL schemes that run code. */
export const SCRIPT_SCHEMES = ['javascript:', 'vbscript:'];

/** Whether an attribute is an event handler (`onclick`, `ONLOAD`, ...). */
export const isEventAttribute = (name) => name.toLowerCase().startsWith('on');

/**
 * The value as a browser reads a URL scheme: without ASCII whitespace and
 * control characters, lower-cased.
 */
function schemeText(value) {
  let out = '';
  for (const c of value) {
    if (c.charCodeAt(0) > 0x20) {
      out += c;
    }
  }
  return out.toLowerCase();
}

/** Whether a value contains a script URL. */
export const hasScriptUrl = (value) => {
  const text = schemeText(value);
  return SCRIPT_SCHEMES.some((scheme) => text.includes(scheme));
};

/**
 * Why an attribute is dropped, or `null` when it is kept.
 * @param {string} name
 * @param {string} value
 */
export function unsafeAttribute(name, value) {
  if (isEventAttribute(name)) {
    return `the event handler attribute "${name}"`;
  }
  if (hasScriptUrl(value)) {
    return `the attribute "${name}" with a script URL`;
  }
  return null;
}

/**
 * A `dropped-script` diagnostic.
 * @param {string} id link id of the dropped element or of the element that
 *   held the dropped attribute
 * @param {string} what
 */
export const droppedScript = (id, what) => ({
  code: 'dropped-script',
  severity: 'warning',
  id,
  message: `Dropped ${what} of "${id}"`,
});
