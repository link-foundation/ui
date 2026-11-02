/**
 * Diagnostics of the converters. Every lossy step of an import or an export
 * adds one, so a caller always knows what did not survive a conversion.
 *
 * A diagnostic has the same shape as the ui-core diagnostics:
 * `{ code, severity, message, at }` where `at` names the format and the JSON
 * path (or the LiNo element id) the diagnostic is about.
 */

/**
 * @typedef {'error'|'warning'|'info'} Severity
 * @typedef {{ format?: string, path?: string, element?: string }} Location
 * @typedef {{ code: string, severity: Severity, message: string, at: Location }} Diagnostic
 */

/**
 * Collects the diagnostics of one conversion.
 */
export class Diagnostics {
  /**
   * @param {string} format The format the conversion reads or writes.
   */
  constructor(format) {
    this.format = format;
    /** @type {Diagnostic[]} */
    this.list = [];
  }

  /**
   * Add a diagnostic.
   * @param {string} code
   * @param {Severity} severity
   * @param {string} message
   * @param {Omit<Location, 'format'>} [at]
   */
  add(code, severity, message, at = {}) {
    this.list.push({
      code,
      severity,
      message,
      at: { format: this.format, ...at },
    });
  }

  /** @param {string} code @param {string} message @param {object} [at] */
  error(code, message, at) {
    this.add(code, 'error', message, at);
  }

  /** @param {string} code @param {string} message @param {object} [at] */
  warning(code, message, at) {
    this.add(code, 'warning', message, at);
  }

  /** @param {string} code @param {string} message @param {object} [at] */
  info(code, message, at) {
    this.add(code, 'info', message, at);
  }
}

/**
 * Whether a list of diagnostics has an error.
 * @param {Diagnostic[]} diagnostics
 */
export const hasErrors = (diagnostics) =>
  diagnostics.some((d) => d.severity === 'error');
