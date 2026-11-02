/**
 * Diagnostics of the style reader and resolver, in the shape of ui-core
 * diagnostics: `{ code, severity, message, at }`, where `at` names the rule,
 * the property, the state or the condition.
 */

const rule = (at) =>
  at.rule === undefined || at.rule === null ? '' : ` of the rule "${at.rule}"`;
const text = (at) => (at.text === undefined ? '' : ` "${at.text}"`);

const MESSAGES = {
  'anonymous-rule': () =>
    'A style rule has no id; write (NAME: style ...) so that dev tools can name it',
  'missing-selector': (at) =>
    `The style${rule(at)} has no (selector ...); it matches nothing`,
  'duplicate-selector': (at) =>
    `The style${rule(at)} has more than one (selector ...); the last one wins`,
  'invalid-selector': (at) =>
    `The selector${rule(at)} has the invalid part${text(at)}; a part is (type KIND), (id ID), (PROP VALUE) or (within SELECTOR...)`,
  'misplaced-selector': (at) =>
    `The selector${rule(at)} is inside a state, media or container block; it must be a direct part of the rule`,
  'unknown-property': (at) =>
    `The style${rule(at)} has the unknown property "${at.property}"`,
  'invalid-value': (at) =>
    `The property "${at.property}"${rule(at)} has the invalid value${text(at)}; expected ${at.expected}`,
  'unknown-state': (at) =>
    `The style${rule(at)} has the unknown state${text(at)}; a state is hover, focus, pressed, disabled, selected or checked`,
  'invalid-condition': (at) =>
    `The ${at.block} block${rule(at)} has the invalid condition${text(at)}`,
  'css-syntax': (at) =>
    `The style${rule(at)} contains the CSS syntax${text(at)}; ":" separates an id from a link in Links Notation, so write (state hover) or (media (max-width 640px)) instead`,
  'unexpected-value': (at) =>
    `The style${rule(at)} has the value${text(at)} where a (NAME VALUE...) link is expected`,
  'unknown-token': (at) =>
    `The property "${at.property}"${rule(at)} refers to the unknown token "${at.token}"`,
  'type-mismatch': (at) =>
    `The property "${at.property}"${rule(at)} expects ${at.expected} but the token "${at.token}" is a ${at.actual}`,
};

/**
 * @param {string} code
 * @param {'error'|'warning'|'info'} severity
 * @param {Record<string, any>} at
 * @returns {import('./types.js').Diagnostic}
 */
export function styleDiagnostic(code, severity, at) {
  return { code, severity, message: MESSAGES[code](at), at };
}
