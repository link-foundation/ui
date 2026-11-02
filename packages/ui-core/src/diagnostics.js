/**
 * Diagnostics of the UI dialect (docs/spec/limits.md): `{ code, severity,
 * at }` plus a human-readable `message`.
 */

const quote = (value) => (value === null ? 'the document root' : `"${value}"`);
const where = (at) =>
  at.element === undefined ? 'the document' : `element ${quote(at.element)}`;

const MESSAGES = {
  'input-too-large': () => 'The input is larger than the allowed size',
  'missing-kind': (at) => `${where(at)} has no kind (its first value)`,
  'unknown-kind': (at) => `${where(at)} has the unknown kind "${at.kind}"`,
  'unknown-sublink': (at) =>
    `${where(at)} has the unknown sublink ${at.head === null ? '(a path that cannot be folded)' : `"${at.head}"`}; it is kept and has no effect`,
  'unexpected-child': (at) => `${where(at)} does not accept children`,
  'duplicate-id': (at) => `The id "${at.element}" is used more than once`,
  'duplicate-property': (at) =>
    `${where(at)} repeats the property "${at.property}"; the last one wins`,
  'reserved-sigil': (at) =>
    `${where(at)} uses the reserved prefix @ or $${at.property ? ` in "${at.property}"` : ''}`,
  'invalid-value': (at) =>
    `${where(at)} has an invalid value${at.property ? ` of "${at.property}"` : ''}`,
  'reference-cycle': (at) =>
    `The token "${at.token}" of ${where(at)} refers to itself`,
  'invalid-handler': (at) =>
    `${where(at)} has a handler without a valid event and actions`,
  'unknown-action': (at) => `${where(at)} has a handler with an unknown action`,
  'unsafe-url': (at) => `${where(at)} navigates to an unsafe URL`,
};

/**
 * Create a diagnostic.
 * @param {string} code
 * @param {'error'|'warning'|'info'} severity
 * @param {import('./types.js').DiagnosticLocation} at
 * @param {string} [message]
 * @returns {import('./types.js').Diagnostic}
 */
export function diagnostic(code, severity, at, message) {
  return {
    code,
    severity,
    message: message ?? MESSAGES[code]?.(at) ?? code,
    at,
  };
}

/**
 * The fixture form of a diagnostic: `{ code, severity, at }`.
 * @param {import('./types.js').Diagnostic} d
 */
export const diagnosticJson = ({ code, severity, at }) => ({
  code,
  severity,
  at,
});
