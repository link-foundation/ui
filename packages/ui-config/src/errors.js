/**
 * The error the configuration API throws on bad input. `code` is one of:
 *
 * - `unknown-layer`: not one of `defaults`, `theme`, `site`, `user`, `session`;
 * - `read-only-layer`: only `user` and `session` can be edited;
 * - `unknown-id`: the base document has no element with this id;
 * - `missing-key`: a keyed prop (`token`, `state`) needs a key;
 * - `bad-value`: the values are not an array of Links Notation values (or,
 *   for the positional values of an element, not atoms);
 * - `bad-patch`: a patch given to `createConfig({ layers })` has an error
 *   (the error has the `diagnostics`).
 */
export class ConfigError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   */
  constructor(code, message) {
    super(message);
    this.name = 'ConfigError';
    this.code = code;
  }
}

/**
 * Throw a {@link ConfigError} unless `condition` holds.
 * @param {unknown} condition
 * @param {string} code
 * @param {string} message
 * @returns {asserts condition}
 */
export function check(condition, code, message) {
  if (!condition) {
    throw new ConfigError(code, message);
  }
}

/**
 * A diagnostic in the shape of ui-core diagnostics.
 * @param {string} code
 * @param {'error'|'warning'|'info'} severity
 * @param {string} message
 * @param {Record<string, unknown>} [at]
 * @returns {import('@link-foundation/ui-core').Diagnostic}
 */
export const diagnostic = (code, severity, message, at = {}) => ({
  code,
  severity,
  message,
  at,
});

/** Whether a list of diagnostics has an error. */
export const hasError = (diagnostics) =>
  diagnostics.some((d) => d.severity === 'error');
