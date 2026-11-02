/**
 * Diagnostics of the DOM renderer, in the ui-core shape
 * `{ code, severity, message, at }`. Rendering never throws on document
 * content: every problem becomes a diagnostic.
 */

const where = (at) =>
  at.element === undefined ? 'The document' : `Element "${at.element}"`;

const MESSAGES = {
  'unknown-kind': (at) =>
    `${where(at)} has the kind "${at.kind}", which has no DOM renderer; it is rendered as ui-unknown`,
  'kind-error': (at) =>
    `${where(at)}: the renderer of kind "${at.kind}" failed (${at.error})`,
  'missing-alt': (at) =>
    `${where(at)} is an image without alt text; alt="" marks it decorative`,
  'unsafe-url': (at) =>
    `${where(at)} uses an unsafe URL${at.property ? ` in "${at.property}"` : ''}; it is ignored`,
  'invalid-handler': (at) =>
    `${where(at)} has a handler without a valid event and actions`,
  'unknown-action': (at) =>
    `${where(at)} has a handler with the unknown action "${at.action}"; it is ignored`,
  'unknown-event': (at) =>
    `${where(at)} handles the event "${at.event}", which the DOM renderer does not map; it is ignored`,
  'invalid-value': (at) =>
    `${where(at)} has an invalid value of "${at.property}"; it is ignored`,
  'bad-event': (at) =>
    `The store event ${at.type} of "${at.element}" does not match the rendered tree; it is ignored`,
};

/**
 * @param {string} code
 * @param {'error'|'warning'|'info'} severity
 * @param {Record<string, unknown>} at
 */
export function diagnostic(code, severity, at) {
  const message = MESSAGES[code]?.(at) ?? code;
  return Object.freeze({ code, severity, message, at: Object.freeze(at) });
}

const UNSAFE_SCHEMES = ['javascript:', 'data:', 'vbscript:'];

/**
 * Whether a URL uses a scheme that runs code (`javascript:`, `vbscript:`)
 * or embeds content (`data:`). Control characters and spaces are dropped
 * first, as browsers do when they read a URL.
 * @param {unknown} url
 */
export function isUnsafeUrl(url) {
  let text = '';
  for (const c of String(url ?? '')) {
    if (c.codePointAt(0) > 0x20) {
      text += c;
    }
  }
  text = text.toLowerCase();
  return UNSAFE_SCHEMES.some((scheme) => text.startsWith(scheme));
}
