/**
 * Diagnostics of the token reader and resolver, in the shape of ui-core
 * diagnostics: `{ code, severity, message, at }`, where `at` names the set,
 * the token and the mode.
 */

const token = (at) => (at.token === undefined ? '' : ` "${at.token}"`);
const set = (at) => (at.set === undefined ? '' : ` of the set "${at.set}"`);
const mode = (at) => (at.mode === undefined ? '' : ` in the mode "${at.mode}"`);
const of = (at) => `${token(at)}${set(at)}${mode(at)}`;

const MESSAGES = {
  'anonymous-set': () => 'A token set (a theme) has no id',
  'invalid-token': (at) =>
    `The token${of(at)} is not (token PATH VALUE); a path is dot-separated names without {, } or a leading $`,
  'invalid-mode': (at) => `A mode${set(at)} has no name`,
  'invalid-value': (at) =>
    `The token${of(at)} has a value that is not ${at.type === undefined ? 'a token value' : `a ${at.type}`}`,
  'unknown-type': (at) =>
    `The token${of(at)} has the unknown type "${at.type}"`,
  'duplicate-token': (at) =>
    `The token${of(at)} is defined more than once; the last one wins`,
  'unknown-set': (at) =>
    at.set === undefined
      ? `The token set "${at.target}" does not exist`
      : `The token set "${at.set}" extends "${at.target}", which does not exist`,
  'extends-cycle': (at) =>
    `The token set "${at.set}" extends itself through ${at.cycle.join(' -> ')}`,
  'unknown-mode': (at) =>
    `No set of the chain${set(at)} has the mode "${at.mode}"`,
  'unknown-alias': (at) =>
    `The token${of(at)} refers to the unknown token "${at.target}"`,
  'alias-cycle': (at) =>
    `The token${of(at)} refers to itself through ${at.cycle.join(' -> ')}`,
  'type-mismatch': (at) =>
    `The token${of(at)} must be a ${at.expected} but "${at.target}" is a ${at.actual}`,
};

/**
 * @param {string} code
 * @param {'error'|'warning'|'info'} severity
 * @param {Record<string, any>} at
 * @returns {import('./types.js').Diagnostic}
 */
export function tokenDiagnostic(code, severity, at) {
  return { code, severity, message: MESSAGES[code](at), at };
}
