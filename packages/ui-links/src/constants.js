/**
 * The constants of a doublets store, with the numbers of `doublets-web`
 * (https://github.com/linksplatform/doublets-web, Unlicense), so a handler
 * written for one storage works with all of them.
 */

/** The empty reference: no link. */
export const NULL = 0;
/** Matches any value in a query. */
export const ANY = 4294967292;
/** Returned by an `each` handler to go on. */
export const CONTINUE = 4294967295;
/** Returned by an `each` handler to stop; `each` then returns it too. */
export const BREAK = 4294967294;
/** Reserved by doublets: skip. */
export const SKIP = 4294967293;
/** Reserved by doublets: the link itself. */
export const ITSELF = 4294967291;
/** Reserved by doublets: an error. */
export const ERROR = 4294967290;
/** The largest address a link can have: every larger number is reserved. */
export const MAX_ADDRESS = ERROR - 1;

/**
 * The `constants` object of every storage, shaped like doublets-web's
 * `LinksConstants`.
 */
export const constants = Object.freeze({
  _null: NULL,
  any: ANY,
  _continue: CONTINUE,
  _break: BREAK,
  skip: SKIP,
  itself: ITSELF,
  error: ERROR,
  index_part: 0,
  source_part: 1,
  target_part: 2,
});
