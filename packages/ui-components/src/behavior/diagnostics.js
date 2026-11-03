/**
 * Diagnostics of the behaviour layer, in the ui-core shape
 * `{ code, severity, message, at }`. Machines, guards and actions never
 * throw on document content: every problem becomes a diagnostic.
 */

const quote = (value) => JSON.stringify(String(value));

const MESSAGES = {
  'invalid-machine': (at) =>
    `${at.machine === undefined ? 'The source' : `Machine ${quote(at.machine)}`} is not a machine (${at.reason})`,
  'missing-initial': (at) =>
    `Machine ${quote(at.machine)} has no (initial <state>)`,
  'unknown-initial': (at) =>
    `Machine ${quote(at.machine)} starts in the unknown state ${quote(at.state)}`,
  'duplicate-state': (at) =>
    `Machine ${quote(at.machine)} declares the state ${quote(at.state)} more than once`,
  'unknown-target': (at) =>
    `Machine ${quote(at.machine)}: state ${quote(at.state)} has a transition to the unknown state ${quote(at.target)}`,
  'invalid-transition': (at) =>
    `Machine ${quote(at.machine)}: state ${quote(at.state)} has an (on ...) without an event name`,
  'invalid-delay': (at) =>
    `Machine ${quote(at.machine)}: state ${quote(at.state)} has the invalid delay ${quote(at.delay)}`,
  'invalid-action': (at) =>
    `Machine ${quote(at.machine)} has an action that is neither a name nor a link`,
  'duplicate-action': (at) =>
    `Machine ${quote(at.machine)} defines the action ${quote(at.action)} more than once`,
  'unknown-field': (at) =>
    `Machine ${quote(at.machine)} has the unknown field ${quote(at.field)}; it is ignored`,
  'unknown-guard': (at) =>
    `The guard ${quote(at.guard)} is not registered; the transition is blocked`,
  'guard-error': (at) =>
    `The guard ${quote(at.guard)} failed (${at.error}); the transition is blocked`,
  'unknown-action': (at) =>
    `The action ${quote(at.action)} is not registered; nothing is run`,
  'action-error': (at) => `The action ${quote(at.action)} failed (${at.error})`,
  'unsafe-url': (at) =>
    `The action ${quote(at.action)} has an unsafe URL; it is not run`,
  'invalid-argument': (at) =>
    `The action ${quote(at.action)} has an invalid argument (${at.reason})`,
  'unhandled-action': (at) =>
    `The action ${quote(at.action)} has no host handler; nothing is run`,
  'unknown-machine': (at) =>
    `Element ${quote(at.element)} refers to the unknown machine ${quote(at.machine)}`,
  'unknown-part': (at) =>
    `Machine ${quote(at.machine)} has no element for the part ${quote(at.part)}`,
};

/**
 * @param {string} code
 * @param {'error'|'warning'|'info'} severity
 * @param {Record<string, unknown>} [at]
 */
export function diagnostic(code, severity, at = {}) {
  const message = MESSAGES[code]?.(at) ?? code;
  return Object.freeze({ code, severity, message, at: Object.freeze(at) });
}

/**
 * Whether a URL uses a scheme that runs code (`javascript:`, `vbscript:`)
 * or embeds content (`data:`). Spaces and control characters are ignored,
 * as browsers ignore them when they read a URL.
 * @param {unknown} url
 */
export function isUnsafeUrl(url) {
  const visible = [...String(url ?? '')]
    .filter((c) => c.codePointAt(0) > 0x20)
    .join('')
    .toLowerCase();
  return ['javascript:', 'data:', 'vbscript:'].some((scheme) =>
    visible.startsWith(scheme)
  );
}
