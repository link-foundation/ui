/**
 * Names of a token path in the output languages: `color.on-primary` is
 * `--color-on-primary` in CSS, `colorOnPrimary` in Swift and
 * `ColorOnPrimary` in Kotlin.
 */

/** The words of a path: `color.on-primary` -> `['color', 'on', 'primary']`. */
const words = (path) => path.split(/[.\-_\s]+/u).filter((w) => w.length > 0);

const capitalise = (w) => w.charAt(0).toUpperCase() + w.slice(1);

/** A name that starts with a digit gets a leading `_`. */
const identifier = (name) => (/^[0-9]/u.test(name) ? `_${name}` : name);

/**
 * `color.on-primary` -> `--color-on-primary`; with the prefix `md`,
 * `--md-color-on-primary`.
 * @param {string} path
 * @param {string} [prefix]
 */
export const cssVariable = (path, prefix = '') =>
  `--${prefix === '' ? '' : `${prefix}-`}${path.split('.').join('-')}`;

/** `color.on-primary` -> `colorOnPrimary` (Swift). */
export const lowerCamel = (path) => {
  const [first = '', ...rest] = words(path);
  return identifier(
    first.charAt(0).toLowerCase() +
      first.slice(1) +
      rest.map(capitalise).join('')
  );
};

/** `color.on-primary` -> `ColorOnPrimary` (Kotlin). */
export const upperCamel = (path) =>
  identifier(words(path).map(capitalise).join(''));
